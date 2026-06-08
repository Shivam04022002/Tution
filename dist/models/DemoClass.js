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
exports.DemoClass = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const DemoClassSchema = new mongoose_1.Schema({
    demoId: {
        type: String,
        required: true,
        unique: true,
    },
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
    },
    applicationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'TutorApplication',
        required: true,
    },
    studentDetails: {
        studentName: {
            type: String,
            required: true,
        },
        grade: {
            type: String,
            required: true,
        },
        subject: {
            type: String,
            required: true,
        },
    },
    scheduledDate: {
        type: Date,
        required: true,
        index: true,
    },
    scheduledTime: {
        type: String,
        required: true,
    },
    duration: {
        type: Number,
        default: 60,
        min: 30,
        max: 180,
    },
    mode: {
        type: String,
        enum: ['online', 'offline'],
        required: true,
    },
    meetingDetails: {
        platform: {
            type: String,
            enum: ['zoom', 'google_meet', 'microsoft_teams', 'skype', 'whatsapp', 'in_person'],
        },
        meetingLink: {
            type: String,
        },
        meetingId: {
            type: String,
        },
        password: {
            type: String,
        },
        address: {
            type: String,
        },
    },
    status: {
        type: String,
        enum: ['scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show'],
        default: 'scheduled',
        index: true,
    },
    previousDates: [{
            date: {
                type: Date,
                required: true,
            },
            time: {
                type: String,
                required: true,
            },
            reason: {
                type: String,
                required: true,
            },
        }],
    feedback: {
        parentFeedback: {
            rating: {
                type: Number,
                min: 1,
                max: 5,
            },
            comment: {
                type: String,
                maxlength: 1000,
            },
            isInterested: {
                type: Boolean,
            },
            submittedAt: {
                type: Date,
            },
        },
        teacherFeedback: {
            rating: {
                type: Number,
                min: 1,
                max: 5,
            },
            comment: {
                type: String,
                maxlength: 1000,
            },
            isInterested: {
                type: Boolean,
            },
            submittedAt: {
                type: Date,
            },
        },
    },
    outcome: {
        type: String,
        enum: ['interested', 'not_interested', 'pending'],
        default: 'pending',
    },
    nextSteps: {
        type: String,
        maxlength: 500,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});
DemoClassSchema.index({ parentId: 1, status: 1, scheduledDate: 1 });
DemoClassSchema.index({ teacherId: 1, status: 1, scheduledDate: 1 });
DemoClassSchema.index({ scheduledDate: 1, status: 1 });
DemoClassSchema.index({ requirementId: 1, status: 1 });
DemoClassSchema.index({ applicationId: 1 });
DemoClassSchema.pre('save', async function () {
    if (!this.demoId) {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        this.demoId = `DEMO-${timestamp}-${random}`;
    }
});
exports.DemoClass = mongoose_1.default.model('DemoClass', DemoClassSchema);
exports.default = exports.DemoClass;
//# sourceMappingURL=DemoClass.js.map