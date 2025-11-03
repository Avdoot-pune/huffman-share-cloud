import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Share2, Trash2, File, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface FileItem {
  id: string;
  file_name: string;
  original_size: number;
  compressed_size: number;
  compression_ratio: number;
  share_id: string;
  storage_path: string;
  created_at: string;
}

interface FileListProps {
  userId: string;
  refreshTrigger: number;
}

export const FileList = ({ userId, refreshTrigger }: FileListProps) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [userId, refreshTrigger]);

  const handleDownload = async (file: FileItem) => {
    setDownloadingId(file.id);
    try {
      // Download compressed file from storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from("compressed-files")
        .download(file.storage_path);

      if (storageError) throw storageError;

      // Convert blob to array buffer
      const arrayBuffer = await storageData.arrayBuffer();
      const compressedData = Array.from(new Uint8Array(arrayBuffer));

      // Call decompress edge function
      const { data: decompressedData, error: decompressError } = await supabase.functions.invoke(
        "decompress-file",
        {
          body: { compressedData },
        }
      );

      if (decompressError) throw decompressError;

      // Create blob and download
      const blob = await decompressedData.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("File downloaded successfully");
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShare = (shareId: string) => {
    const shareUrl = `${window.location.origin}/share/${shareId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard!");
  };

  const handleDelete = async (file: FileItem) => {
    try {
      // Delete from storage
      await supabase.storage.from("compressed-files").remove([file.storage_path]);

      // Delete from database
      const { error } = await supabase.from("files").delete().eq("id", file.id);

      if (error) throw error;

      toast.success("File deleted");
      loadFiles();
    } catch (error: any) {
      toast.error("Failed to delete file");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <File className="h-12 w-12 mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No files yet</h3>
          <p className="text-sm text-muted-foreground">
            Upload your first file to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Your Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex-1 min-w-0 mr-4">
                <h4 className="font-medium truncate">{file.file_name}</h4>
                <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                  <span>
                    {formatBytes(file.original_size)} → {formatBytes(file.compressed_size)}
                  </span>
                  <span className="text-accent font-medium">
                    {file.compression_ratio.toFixed(1)}% smaller
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDownload(file)}
                  disabled={downloadingId === file.id}
                >
                  {downloadingId === file.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleShare(file.share_id)}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDelete(file)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};