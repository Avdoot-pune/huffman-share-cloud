import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { nanoid } from "nanoid";

interface FileUploadProps {
  onUploadComplete: () => void;
  userId: string;
}

export const FileUpload = ({ onUploadComplete, userId }: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      console.log("Starting compression for:", file.name);

      // Call compress edge function
      const formData = new FormData();
      formData.append("file", file);

      const { data: compressionData, error: compressionError } = await supabase.functions.invoke(
        "compress-file",
        {
          body: formData,
        }
      );

      if (compressionError) throw compressionError;

      console.log("Compression complete:", compressionData);

      // Upload compressed data to storage
      const shareId = nanoid(10);
      const storagePath = `${userId}/${shareId}`;
      const compressedBytes = new Uint8Array(compressionData.compressedData);

      const { error: uploadError } = await supabase.storage
        .from("compressed-files")
        .upload(storagePath, compressedBytes, {
          contentType: "application/octet-stream",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Save metadata to database
      const { error: dbError } = await supabase.from("files").insert({
        user_id: userId,
        file_name: file.name,
        original_size: compressionData.originalSize,
        compressed_size: compressionData.compressedSize,
        compression_ratio: compressionData.compressionRatio,
        share_id: shareId,
        storage_path: storagePath,
        mime_type: file.type || "application/octet-stream",
      });

      if (dbError) throw dbError;

      toast.success(`File compressed! ${compressionData.compressionRatio}% smaller`);
      onUploadComplete();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <Card
      className={`border-2 border-dashed transition-all ${
        dragActive ? "border-primary bg-primary/5" : "border-border"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Upload className="h-12 w-12 mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">Upload a file to compress</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Drag and drop or click to browse
        </p>
        <Button disabled={uploading} asChild={!uploading}>
          {uploading ? (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Compressing...
            </Button>
          ) : (
            <label className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                onChange={handleFileInput}
                disabled={uploading}
              />
              Select File
            </label>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};