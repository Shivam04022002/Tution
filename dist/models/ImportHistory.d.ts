import mongoose, { Document } from 'mongoose';
export type ImportType = 'parents' | 'teachers';
export type ImportStatus = 'processing' | 'completed' | 'failed' | 'partial';
export interface IImportError {
    rowNumber: number;
    rowData?: Record<string, any>;
    errorMessage: string;
}
export interface IImportHistory extends Document {
    uploadedBy: mongoose.Types.ObjectId;
    fileName: string;
    importType: ImportType;
    totalRows: number;
    successfulRows: number;
    failedRows: number;
    duplicates: number;
    status: ImportStatus;
    rowErrors: IImportError[];
    createdAt: Date;
}
export declare const ImportHistory: mongoose.Model<IImportHistory, {}, {}, {}, mongoose.Document<unknown, {}, IImportHistory, {}, mongoose.DefaultSchemaOptions> & IImportHistory & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IImportHistory>;
export default ImportHistory;
//# sourceMappingURL=ImportHistory.d.ts.map