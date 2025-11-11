import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    } });
  }

  try {
    const { shareId } = await req.json();

    if (!shareId) {
      return new Response(JSON.stringify({ error: "shareId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Retrieve file metadata from the database
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("*")
      .eq("share_id", shareId)
      .single();

    if (fileError || !file) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate a signed URL for the file
    const { data, error: urlError } = await supabase.storage
      .from("compressed-files")
      .createSignedUrl(file.storage_path, 60 * 5); // URL valid for 5 minutes

    if (urlError || !data) {
      return new Response(
        JSON.stringify({ error: "Could not generate download URL" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ ...file, downloadUrl: data.signedUrl }), {
      headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});