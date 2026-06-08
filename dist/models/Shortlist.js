"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Shortlist = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ShortlistSchema = new mongoose_1.Schema({
    parentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    teacherId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    teacherProfileId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'TeacherProfile',
        required: true,
    },
    requirementId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'ParentRequirement',
        required: true,
        index: true,
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 1000,
    },
    matchScore: {
        type: Number,
        min: 0,
        max: 100,
    },
    isContacted: {
        type: Boolean,
        default: false,
    },
    contactedAt: {
        type: Date,
    },
    contactMethod: {
        type: String,
        enum: ['call', 'whatsapp', 'email', 'sms'],
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});
ShortlistSchema.index({ parentId: 1, requirementId: 1, isDeleted: 1 });
ShortlistSchema.index({ parentId: 1, teacherId: 1, requirementId: 1 }, { unique: true });
ShortlistSchema.index({ parentId: 1, createdAt: -1 });
ShortlistSchema.index({ teacherId: 1, isDeleted: 1 });
ShortlistSchema.pre('save', function () {
});
exports.Shortlist = mongoose_1.default.model('Shortlist', ShortlistSchema);
exports.default = exports.Shortlist;
//# sourceMappingURL=Shortlist.js.map