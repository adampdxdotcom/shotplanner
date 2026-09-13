import { MediaAsset } from "../../../types";

export interface BulkQueueItem {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

export interface UploadSummary {
  total: number;
  completed: number;
  errors: number;
}

export interface GalleryBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: string[];
  defaultSubject?: string;
  isLocation?: boolean;
  characters?: Record<string, any>;
  assets?: MediaAsset[];
  sceneName?: string;
  config?: any;
  onAssetUploaded: (asset: MediaAsset) => void;
  onRegisterSubject: (name: string) => void;
}
