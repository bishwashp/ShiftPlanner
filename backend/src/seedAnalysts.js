"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../generated/prisma");
const prisma = new prisma_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield prisma.analyst.createMany({
            data: [
                { name: 'Alice Morning', email: 'alice.morning@example.com', shiftType: 'MORNING' },
                { name: 'Bob Morning', email: 'bob.morning@example.com', shiftType: 'MORNING' },
                { name: 'Carol Evening', email: 'carol.evening@example.com', shiftType: 'EVENING' },
                { name: 'Dave Evening', email: 'dave.evening@example.com', shiftType: 'EVENING' }
            ]
        });
        console.log('Dummy analysts created');
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
