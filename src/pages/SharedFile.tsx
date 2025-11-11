
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const SharedFile = () => {
  const { shareId } = useParams();
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFile = async () => {
      if (!shareId) {
        setError("No share ID provided.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("get-shared-file", {
        body: { shareId },
      });

      if (error) {
        setError("Failed to fetch file data.");
        console.error(error);
      } else {
        setFile(data);
      }
      setLoading(false);
    };

    fetchFile();
  }, [shareId]);

  const handleDownload = async () => {
    if (!file || !file.downloadUrl) return;

    setDownloading(true);
    try {
      // Fetch the compressed file
      const response = await fetch(file.downloadUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch compressed file.");
      }
      const compressedBlob = await response.blob();
      const arrayBuffer = await compressedBlob.arrayBuffer();
      const compressedData = Array.from(new Uint8Array(arrayBuffer));

      // Decompress the file
      const { data: decompressedData, error: decompressError } = await supabase.functions.invoke(
        "decompress-file",
        {
          body: { compressedData },
        }
      );

      if (decompressError) throw decompressError;

      // Create blob and download
      const blob = new Blob([decompressedData]);
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
      toast.error("Failed to download file.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>File not found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="p-8 rounded-lg shadow-md border">
        <h1 className="text-2xl font-bold mb-4">{file.file_name}</h1>
        <p className="mb-2">
          <strong>Original Size:</strong> {file.original_size} bytes
        </p>
        <p className="mb-4">
          <strong>Compressed Size:</strong> {file.compressed_size} bytes
        </p>
        <Button onClick={handleDownload} disabled={downloading}>
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          {downloading ? "Downloading..." : "Download"}
        </Button>
      </div>
    </div>
  );
};

export default SharedFile;
