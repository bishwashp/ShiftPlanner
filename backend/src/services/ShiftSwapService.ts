import { PrismaClient, ShiftSwap, Prisma } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import moment from 'moment-timezone';

export interface SwapRequestData {
    requestingAnalystId: string;
    requestingShiftDate: Date;
    targetAnalystId?: string; // Optional for broadcast
    targetShiftDate?: Date; // Optional for broadcast
    isBroadcast?: boolean;
    parentId?: string; // Optional for offers
}

export class ShiftSwapService {
    private prisma: PrismaClient;

    constructor(prismaClient?: PrismaClient) {
        this.prisma = prismaClient || prisma;
    }

    /**
     * Create a new swap request (Direct, Broadcast, or Offer).
     */
    async createSwapRequest(data: SwapRequestData): Promise<ShiftSwap> {
        // Validation logic
        await this.validateSwapEligibility(data);

        // If it's an OFFER (has parentId), validate parent exists and is OPEN
        if (data.parentId) {
            const parent = await this.prisma.shiftSwap.findUnique({
                where: { id: data.parentId }
            });
            if (!parent || parent.status !== 'OPEN') {
                throw new Error('Broadcast request is no longer open');
            }
            // Ensure offer is consistent with parent request
            // Parent wants to swap away date X. Offer is giving date Y in exchange.
            // data.requestingShiftDate corresponds to date Y.
            // data.targetAnalystId (Requester of offer) is targeting Parent's Requester.
        }

        const status = data.isBroadcast ? 'OPEN' : 'PENDING_PARTNER';

        return await this.prisma.shiftSwap.create({
            data: {
                requestingAnalystId: data.requestingAnalystId,
                requestingShiftDate: data.requestingShiftDate,
                targetAnalystId: data.isBroadcast ? undefined : data.targetAnalystId, // Explicitly undefined if broadcast
                targetShiftDate: data.targetShiftDate,
                isBroadcast: data.isBroadcast || false,
                parentId: data.parentId,
                status
            }
        });
    }

    private async validateSwapEligibility(data: SwapRequestData): Promise<void> {
        // 1. Region Check
        const requester = await this.prisma.analyst.findUnique({ where: { id: data.requestingAnalystId } });
        if (!requester) throw new Error('Requesting analyst not found');

        if (data.targetAnalystId) {
            const target = await this.prisma.analyst.findUnique({ where: { id: data.targetAnalystId } });
            if (!target) throw new Error('Target analyst not found');

            if (requester.regionId !== target.regionId) {
                throw new Error('Swaps are only allowed within the same region');
            }
        }

        // 2. Schedule Check (Is it Screener or Weekend?)
        // Fetch schedule for requesting date
        const scheduleA = await this.prisma.schedule.findUnique({
            where: { analystId_date: { analystId: data.requestingAnalystId, date: data.requestingShiftDate } }
        });

        if (!scheduleA) {
            throw new Error('No schedule found for the requesting date');
        }

        const isWeekendA = moment(data.requestingShiftDate).isoWeekday() >= 6; // 6=Sat, 7=Sun

        // Strict rule: Screener OR Weekend only
        if (!scheduleA.isScreener && !isWeekendA) {
            throw new Error('Only Screener or Weekend shifts are eligible for swapping');
        }

        // Check target date if provided (for 2-way swap)
        if (data.targetShiftDate && data.targetAnalystId) {
            const scheduleB = await this.prisma.schedule.findUnique({
                where: { analystId_date: { analystId: data.targetAnalystId, date: data.targetShiftDate } }
            });

            if (!scheduleB) {
                throw new Error('Target analyst does not have a schedule on the specified date');
            }

            // Note: We might relax rules for the *incoming* shift, but typically constraints apply both ways.
            // For now, let's enforce eligibility on both sides to prevent circumventing rules.
            const isWeekendB = moment(data.targetShiftDate).isoWeekday() >= 6;
            if (!scheduleB.isScreener && !isWeekendB) {
                throw new Error('Target shift must also be a Screener or Weekend shift');
            }
        }
    }

    /**
     * Get swaps for an analyst (Incoming, Outgoing, History).
     */
    async getAnalystSwaps(analystId: string) {
        const outgoing = await this.prisma.shiftSwap.findMany({
            where: { requestingAnalystId: analystId, parentId: null },
            include: {
                targetAnalyst: true,
                offers: {
                    include: {
                        requestingAnalyst: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const incoming = await this.prisma.shiftSwap.findMany({
            where: { targetAnalystId: analystId },
            include: { requestingAnalyst: true },
            orderBy: { createdAt: 'desc' }
        });

        // "Offers I made" are technically outgoing but child records
        const myOffers = await this.prisma.shiftSwap.findMany({
            where: { requestingAnalystId: analystId, parentId: { not: null } },
            include: {
                parent: {
                    include: { requestingAnalyst: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return { outgoing, incoming, myOffers };
    }

    /**
     * Get available broadcast requests for a region.
     */
    async getBroadcastFeed(regionId: string, excludeAnalystId: string) {
        return await this.prisma.shiftSwap.findMany({
            where: {
                isBroadcast: true,
                status: 'OPEN',
                requestingAnalystId: { not: excludeAnalystId },
                requestingAnalyst: { regionId }
            },
            include: {
                requestingAnalyst: {
                    select: { name: true, regionId: true }
                }
            },
            orderBy: { requestingShiftDate: 'asc' }
        });
    }

    /**
     * Approve a direct swap or accept an offer.
     */
    async approveSwap(swapId: string, approverId: string): Promise<void> {
        const swap = await this.prisma.shiftSwap.findUnique({
            where: { id: swapId },
            include: { parent: true }
        });

        if (!swap) throw new Error('Swap not found');

        // If this is an OFFER (has parent), the approver must be the parent's owner
        if (swap.parentId) {
            if (swap.parent?.requestingAnalystId !== approverId) {
                throw new Error('Unauthorized to accept this offer');
            }
            // Accept logic for Offer -> Updates parent to FILLED, executes swap
            await this.executeSwap(swap);
        } else {
            // Direct swap: Approver must be the target
            if (swap.targetAnalystId !== approverId) {
                throw new Error('Unauthorized to approve this swap');
            }
            await this.executeSwap(swap);
        }
    }

    /**
     * Execute the swap: Update schedules and status.
     * Logic:
     * - If Direct Swap: Swap analysts for the respective dates.
     * - If Broadcast Offer: Swap requester's shift (Target Date) with Offer Maker's shift (Requesting Date).
     */
    private async executeSwap(swap: ShiftSwap): Promise<void> {
        // Resolve effective parameters
        // If swap has parent, it's an OFFER.
        // Parent = Broadcast Request (Needs coverage on parent.requestingShiftDate)
        // Swap = Offer (Offer to cover using swap.requestingShiftDate)

        let validSwap = swap;
        let parentRequest: ShiftSwap | null = null;

        if (swap.parentId) {
            parentRequest = await this.prisma.shiftSwap.findUnique({
                where: { id: swap.parentId }
            });
            if (!parentRequest) throw new Error('Parent broadcast request not found');
        }

        /*
           Scenario A: Direct Swap (No parent)
           - User A (requestingAnalyst) wants to give away Date X (requestingShiftDate)
           - User B (targetAnalyst) takes it, giving Date Y (targetShiftDate, optional)
        */

        const analystA = swap.requestingAnalystId;
        const dateA = swap.requestingShiftDate;

        const analystB = swap.targetAnalystId; // If null (give away?), logic might differ. Assuming 1:1 swap for now or Pickup.
        const dateB = swap.targetShiftDate;

        if (!analystB) throw new Error('Target analyst missing for execution');

        // Atomic transaction
        await this.prisma.$transaction(async (tx) => {
            // 1. Update Statuses
            if (parentRequest) {
                await tx.shiftSwap.update({
                    where: { id: parentRequest.id },
                    data: { status: 'FILLED' }
                });
            }

            await tx.shiftSwap.update({
                where: { id: swap.id },
                data: { status: 'APPROVED' }
            });

            // 2. Perform Schedule Swap
            // A gives Date A to B
            // B gives Date B to A (if Date B exists)

            // Move Schedule A: Analyst A -> Analyst B
            const scheduleA = await tx.schedule.findUnique({
                where: { analystId_date: { analystId: analystA, date: dateA } }
            });

            if (scheduleA) {
                // Check if B already has a schedule on Date A (Conflict?)
                // For simplified swapping, we update the existing schedule record
                // BUT primary key is [analystId, date]. We can't just update analystId if one already exists for B.

                // Better approach: Delete A's schedule, Create B's schedule (replicating props)
                await tx.schedule.delete({
                    where: { id: scheduleA.id }
                });

                await tx.schedule.create({
                    data: {
                        analystId: analystB,
                        date: dateA,
                        shiftType: scheduleA.shiftType,
                        isScreener: scheduleA.isScreener,
                        regionId: scheduleA.regionId
                    }
                });
            }

            // Move Schedule B: Analyst B -> Analyst A (if 2-way swap)
            if (dateB) {
                const scheduleB = await tx.schedule.findUnique({
                    where: { analystId_date: { analystId: analystB, date: dateB } }
                });

                if (scheduleB) {
                    await tx.schedule.delete({
                        where: { id: scheduleB.id }
                    });

                    await tx.schedule.create({
                        data: {
                            analystId: analystA, // Goes to A
                            date: dateB,
                            shiftType: scheduleB.shiftType,
                            isScreener: scheduleB.isScreener,
                            regionId: scheduleB.regionId
                        }
                    });
                }
            }
        });
    }
}

export const shiftSwapService = new ShiftSwapService();
