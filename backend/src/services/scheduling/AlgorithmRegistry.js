"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlgorithmRegistry = void 0;
const WeekendRotationAlgorithm_1 = __importDefault(require("./algorithms/WeekendRotationAlgorithm"));
const algorithms = {
    [WeekendRotationAlgorithm_1.default.name]: WeekendRotationAlgorithm_1.default,
};
exports.AlgorithmRegistry = {
    getAlgorithm(name) {
        return algorithms[name];
    },
    listAlgorithms() {
        return Object.values(algorithms);
    }
};
