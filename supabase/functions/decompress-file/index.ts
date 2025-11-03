import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Huffman Tree Node
class HuffmanNode {
  char: string;
  left: HuffmanNode | null;
  right: HuffmanNode | null;

  constructor(char: string = '', left: HuffmanNode | null = null, right: HuffmanNode | null = null) {
    this.char = char;
    this.left = left;
    this.right = right;
  }
}

// Deserialize tree
function deserializeTree(treeData: string): { node: HuffmanNode | null, index: number } {
  let index = 0;
  
  function parse(data: string, pos: number): { node: HuffmanNode | null, newPos: number } {
    if (pos >= data.length) return { node: null, newPos: pos };
    
    const flag = data[pos];
    if (flag === '1') {
      // Leaf node
      const charCode = parseInt(data.slice(pos + 1, pos + 3), 16);
      return {
        node: new HuffmanNode(String.fromCharCode(charCode)),
        newPos: pos + 3
      };
    } else {
      // Internal node
      const leftResult = parse(data, pos + 1);
      const rightResult = parse(data, leftResult.newPos);
      return {
        node: new HuffmanNode('', leftResult.node, rightResult.node),
        newPos: rightResult.newPos
      };
    }
  }
  
  const result = parse(treeData, 0);
  return { node: result.node, index: result.newPos };
}

// Convert bytes to bit string
function bytesToBitString(bytes: Uint8Array, bitLength: number): string {
  let bitString = '';
  for (const byte of bytes) {
    bitString += byte.toString(2).padStart(8, '0');
  }
  return bitString.slice(0, bitLength);
}

// Decode data using Huffman tree
function decodeData(bitString: string, root: HuffmanNode): Uint8Array {
  const decoded: number[] = [];
  let current = root;
  
  for (const bit of bitString) {
    current = bit === '0' ? current.left! : current.right!;
    
    if (!current.left && !current.right) {
      decoded.push(current.char.charCodeAt(0));
      current = root;
    }
  }
  
  return new Uint8Array(decoded);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { compressedData } = await req.json();
    
    if (!compressedData) {
      throw new Error('No compressed data provided');
    }

    console.log('Decompressing file...');

    const data = new Uint8Array(compressedData);
    
    // Read header length
    const headerLength = new DataView(data.buffer, data.byteOffset, 4).getUint32(0, false);
    
    // Read header
    const headerBytes = data.slice(4, 4 + headerLength);
    const headerJSON = new TextDecoder().decode(headerBytes);
    const header = JSON.parse(headerJSON);
    
    // Read compressed data
    const compressedBytes = data.slice(4 + headerLength);
    
    // Deserialize tree
    const { node: root } = deserializeTree(header.tree);
    
    if (!root) {
      throw new Error('Failed to deserialize Huffman tree');
    }
    
    // Convert to bit string
    const bitString = bytesToBitString(compressedBytes, header.bitLength);
    
    // Decode
    const decodedData = decodeData(bitString, root);
    
    console.log(`Decompression complete. Decoded size: ${decodedData.length} bytes`);

    // Create a new ArrayBuffer from the Uint8Array
    const buffer = new ArrayBuffer(decodedData.length);
    const view = new Uint8Array(buffer);
    view.set(decodedData);

    return new Response(
      buffer,
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/octet-stream',
        },
      }
    );
  } catch (error) {
    console.error('Decompression error:', error);
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