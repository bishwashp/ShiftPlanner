import { PrismaClient, ConstraintTemplate } from '../../generated/prisma';
import { prisma } from '../lib/prisma';

export interface TemplateParameter {
    name: string;
    type: 'number' | 'string' | 'boolean' | 'analystId';
    required: boolean;
    default?: any;
    min?: number;
    max?: number;
    description?: string;
}

export interface TemplateDefinition {
    name: string;
    displayName: string;
    description: string;
    parameters: TemplateParameter[];
    overridesWeekendRules: boolean;
    overridesScreenerRules: boolean;
}

// Default constraint templates
export const DEFAULT_TEMPLATES: TemplateDefinition[] = [
    {
        name: 'ANALYSTS_PER_DAY',
        displayName: 'Analysts Per Day',
        description: 'Set exact number of analysts required for a specific day or date range',
        parameters: [
            { name: 'count', type: 'number', required: true, min: 1, max: 20, description: 'Number of analysts required' },
            { name: 'shiftType', type: 'string', required: false, description: 'Optional: MORNING, EVENING, or leave empty for all shifts' }
        ],
        overridesWeekendRules: true,
        overridesScreenerRules: true,
    },
    {
        name: 'SPECIFIC_ANALYST_REQUIRED',
        displayName: 'Specific Analyst Required',
        description: 'Require a specific analyst to work on certain dates',
        parameters: [
            { name: 'analystId', type: 'analystId', required: true, description: 'The analyst who must work' },
            { name: 'shiftType', type: 'string', required: false, description: 'Optional: MORNING or EVENING' }
        ],
        overridesWeekendRules: true,
        overridesScreenerRules: false,
    },
    {
        name: 'BLACKOUT_PERIOD',
        displayName: 'Blackout Period',
        description: 'Block scheduling for specific dates (holidays, special events)',
        parameters: [
            { name: 'reason', type: 'string', required: false, description: 'Reason for blackout' }
        ],
        overridesWeekendRules: true,
        overridesScreenerRules: true,
    },
    {
        name: 'REDUCED_STAFFING',
        displayName: 'Reduced Staffing',
        description: 'Allow reduced staffing during low-demand periods',
        parameters: [
            { name: 'morningCount', type: 'number', required: true, min: 0, max: 10, description: 'Morning shift analysts' },
            { name: 'eveningCount', type: 'number', required: true, min: 0, max: 10, description: 'Evening shift analysts' }
        ],
        overridesWeekendRules: true,
        overridesScreenerRules: true,
    },
];

export class ConstraintTemplateService {
    private prisma: PrismaClient;

    constructor(prismaClient?: PrismaClient) {
        this.prisma = prismaClient || prisma;
    }

    /**
     * Get all active constraint templates.
     */
    async getTemplates(): Promise<ConstraintTemplate[]> {
        return this.prisma.constraintTemplate.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Get a template by name.
     */
    async getTemplateByName(name: string): Promise<ConstraintTemplate | null> {
        return this.prisma.constraintTemplate.findUnique({
            where: { name },
        });
    }

    /**
     * Get a template by ID.
     */
    async getTemplateById(id: string): Promise<ConstraintTemplate | null> {
        return this.prisma.constraintTemplate.findUnique({
            where: { id },
        });
    }

    /**
     * Parse template parameters from JSON string.
     */
    parseParameters(template: ConstraintTemplate): TemplateParameter[] {
        try {
            return JSON.parse(template.parameters);
        } catch {
            return [];
        }
    }

    /**
     * Validate constraint parameters against template definition.
     */
    validateParams(
        template: ConstraintTemplate,
        params: Record<string, any>
    ): { valid: boolean; errors: string[] } {
        const parameters = this.parseParameters(template);
        const errors: string[] = [];

        for (const param of parameters) {
            const value = params[param.name];

            // Check required
            if (param.required && (value === undefined || value === null || value === '')) {
                errors.push(`Parameter "${param.name}" is required`);
                continue;
            }

            if (value === undefined || value === null) continue;

            // Type validation
            switch (param.type) {
                case 'number':
                    if (typeof value !== 'number' && isNaN(Number(value))) {
                        errors.push(`Parameter "${param.name}" must be a number`);
                    } else {
                        const numValue = Number(value);
                        if (param.min !== undefined && numValue < param.min) {
                            errors.push(`Parameter "${param.name}" must be at least ${param.min}`);
                        }
                        if (param.max !== undefined && numValue > param.max) {
                            errors.push(`Parameter "${param.name}" must be at most ${param.max}`);
                        }
                    }
                    break;
                case 'string':
                    if (typeof value !== 'string') {
                        errors.push(`Parameter "${param.name}" must be a string`);
                    }
                    break;
                case 'boolean':
                    if (typeof value !== 'boolean') {
                        errors.push(`Parameter "${param.name}" must be a boolean`);
                    }
                    break;
                case 'analystId':
                    if (typeof value !== 'string' || value.length === 0) {
                        errors.push(`Parameter "${param.name}" must be a valid analyst ID`);
                    }
                    break;
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Create a new template (admin only).
     */
    async createTemplate(definition: TemplateDefinition): Promise<ConstraintTemplate> {
        return this.prisma.constraintTemplate.create({
            data: {
                name: definition.name,
                displayName: definition.displayName,
                description: definition.description,
                parameters: JSON.stringify(definition.parameters),
                overridesWeekendRules: definition.overridesWeekendRules,
                overridesScreenerRules: definition.overridesScreenerRules,
                isActive: true,
            },
        });
    }

    /**
     * Seed default templates if not present.
     */
    async seedDefaultTemplates(): Promise<{ created: number; skipped: number }> {
        let created = 0;
        let skipped = 0;

        for (const template of DEFAULT_TEMPLATES) {
            const existing = await this.prisma.constraintTemplate.findUnique({
                where: { name: template.name },
            });

            if (existing) {
                skipped++;
                continue;
            }

            await this.createTemplate(template);
            created++;
            console.log(`📋 Created constraint template: ${template.name}`);
        }

        return { created, skipped };
    }

    /**
     * Deactivate a template.
     */
    async deactivateTemplate(id: string): Promise<ConstraintTemplate> {
        return this.prisma.constraintTemplate.update({
            where: { id },
            data: { isActive: false },
        });
    }

    /**
     * Check if a template overrides weekend rules.
     */
    async checkOverridesWeekend(templateId: string): Promise<boolean> {
        const template = await this.getTemplateById(templateId);
        return template?.overridesWeekendRules ?? false;
    }

    /**
     * Check if a template overrides screener rules.
     */
    async checkOverridesScreener(templateId: string): Promise<boolean> {
        const template = await this.getTemplateById(templateId);
        return template?.overridesScreenerRules ?? false;
    }
}

// Export singleton instance
export const constraintTemplateService = new ConstraintTemplateService();
