import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Huffman Tree Node
class HuffmanNode {
  char: string;
  freq: number;
  left: HuffmanNode | null;
  right: HuffmanNode | null;

  constructor(char: string, freq: number, left: HuffmanNode | null = null, right: HuffmanNode | null = null) {
    this.char = char;
    this.freq = freq;
    this.left = left;
    this.right = right;
  }
}

// Build frequency map
function buildFrequencyMap(data: Uint8Array): Map<number, number> {
  const freq = new Map<number, number>();
  for (const byte of data) {
    freq.set(byte, (freq.get(byte) || 0) + 1);
  }
  return freq;
}

// Build Huffman Tree
function buildHuffmanTree(freq: Map<number, number>): HuffmanNode {
  const nodes: HuffmanNode[] = [];
  
  for (const [byte, frequency] of freq.entries()) {
    nodes.push(new HuffmanNode(String.fromCharCode(byte), frequency));
  }
  
  // Sort by frequency
  nodes.sort((a, b) => a.freq - b.freq);
  
  while (nodes.length > 1) {
    const left = nodes.shift()!;
    const right = nodes.shift()!;
    const parent = new HuffmanNode('', left.freq + right.freq, left, right);
    
    // Insert parent maintaining sorted order
    let inserted = false;
    for (let i = 0; i < nodes.length; i++) {
      if (parent.freq <= nodes[i].freq) {
        nodes.splice(i, 0, parent);
        inserted = true;
        break;
      }
    }
    if (!inserted) nodes.push(parent);
  }
  
  return nodes[0];
}

// Generate Huffman codes
function generateCodes(node: HuffmanNode | null, code: string, codes: Map<number, string>) {
  if (!node) return;
  
  if (!node.left && !node.right && node.char) {
    codes.set(node.char.charCodeAt(0), code || '0');
    return;
  }
  
  generateCodes(node.left, code + '0', codes);
  generateCodes(node.right, code + '1', codes);
}

// Encode data
function encodeData(data: Uint8Array, codes: Map<number, string>): string {
  let encoded = '';
  for (const byte of data) {
    encoded += codes.get(byte) || '';
  }
  return encoded;
}

// Convert bit string to bytes
function bitStringToBytes(bitString: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < bitString.length; i += 8) {
    const byte = bitString.slice(i, i + 8).padEnd(8, '0');
    bytes.push(parseInt(byte, 2));
  }
  return new Uint8Array(bytes);
}

// Serialize tree for storage
function serializeTree(node: HuffmanNode | null): string {
  if (!node) return '';
  if (!node.left && !node.right) {
    return `1${node.char.charCodeAt(0).toString(16).padStart(2, '0')}`;
  }
  return `0${serializeTree(node.left)}${serializeTree(node.right)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No file provided');
    }

    console.log(`Compressing file: ${file.name}, size: ${file.size} bytes`);

    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    // Build frequency map
    const freq = buildFrequencyMap(data);
    
    // Build Huffman tree
    const root = buildHuffmanTree(freq);
    
    // Generate codes
    const codes = new Map<number, string>();
    generateCodes(root, '', codes);
    
    // Encode data
    const encodedBits = encodeData(data, codes);
    
    // Convert to bytes
    const compressedData = bitStringToBytes(encodedBits);
    
    // Serialize tree
    const treeData = serializeTree(root);
    
    // Create header with tree and original length
    const header = {
      tree: treeData,
      originalSize: data.length,
      bitLength: encodedBits.length,
    };
    
    const headerJSON = JSON.stringify(header);
    const headerBytes = new TextEncoder().encode(headerJSON);
    const headerLength = new Uint8Array(4);
    new DataView(headerLength.buffer).setUint32(0, headerBytes.length, false);
    
    // Combine header and compressed data
    const result = new Uint8Array(headerLength.length + headerBytes.length + compressedData.length);
    result.set(headerLength, 0);
    result.set(headerBytes, headerLength.length);
    result.set(compressedData, headerLength.length + headerBytes.length);
    
    const compressionRatio = ((1 - (result.length / data.length)) * 100).toFixed(2);
    
    console.log(`Compression complete. Original: ${data.length}, Compressed: ${result.length}, Ratio: ${compressionRatio}%`);

    return new Response(
      JSON.stringify({
        compressedData: Array.from(result),
        originalSize: data.length,
        compressedSize: result.length,
        compressionRatio: parseFloat(compressionRatio),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Compression error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});