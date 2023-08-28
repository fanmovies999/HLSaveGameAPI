import { LOADING_COMPRESSION_CHUNK_SIZE, LOADING_COMPRESSION_CHUNK_SIZEn, PACKAGE_FILE_TAG, PACKAGE_FILE_TAG_SWAPPED, ARCHIVE_V2_HEADER_TAG } from './constants.js';
import { OodleDecompress } from './oodledecompress.js';
import { Buffer } from 'node:buffer';

const bigIntMax = (args : any[]) => args.reduce((m, e) => e > m ? e : m);
const bigIntMin = (args : any[]) => args.reduce((m, e) => e < m ? e : m);

class FCompressedChunkInfo {
    public CompressedSize: bigint;
    public UncompressedSize: bigint;

    public constructor(compressedSize: bigint, uncompressedSize: bigint) {
        this.CompressedSize = compressedSize;
        this.UncompressedSize = uncompressedSize;
    }
}

export abstract class FArchive {
    private readonly _name: string;

    constructor(name: string){
        this._name = name;
    }

    public Name() : string {
        return this._name;        
    }

    public ReadBuffer() : Buffer {
        // ReadArray<byte>()
        var length = this.ReadInt();

        return length > 0 ? this.ReadBufferWithLength(length) : Buffer.alloc(0);
    }

    public ReadBufferWithLength(length: number) : Buffer {
        // ReadArray<byte>(length)

        if (length <= 0) return Buffer.alloc(0);
  
        var size = 1; // size of byte
        return this.ReadBytes(size * length);
    }

    public ReadInt(): number {
        var size = 4; // int = int32      
        var buffer = this.ReadBytes(size);
        return buffer.readInt32LE();
    }

    public ReadBytes(length: number) : Buffer {
        //var result = Buffer.alloc(length);        
        return this.Read(0, length);
    }

    // To be implemented in inherited class
    abstract Read(offset: number, count: number) : Buffer;

    public SerializeCompressedNew(length: number) : Buffer {
        var dest = Buffer.alloc(length);
       
        // Variables from parameters (that we don't use)
        var compressionFormatToDecodeOldV1Files = "Oolde";
        var flags = "COMPRESS_None" ; // ECompressionFlags 
        var bTreatBufferAsFileReader = false;
        var outPartialReadLength = 0n; // output length
        // End Variables from parameters (that we don't use)


        // CompressionFormatToEncode can be changed freely without breaking loading of old files
        // CompressionFormatToDecodeOldV1Files must match what was used to encode old files, cannot change

        // Serialize package file tag used to determine endianess.
        var packageFileTag = this.ReadFCompressedChunkInfo();

        // v1 header did not store CompressionFormatToDecode
        //	assume it was CompressionFormatToDecodeOldV1Files (usually Zlib)
        var compressionFormatToDecode = compressionFormatToDecodeOldV1Files;

        var bHeaderWasValid = false;
        var bWasByteSwapped = false;
        var bReadCompressionFormat = false;

        // FPackageFileSummary has int32 Tag == PACKAGE_FILE_TAG
        // this header does not otherwise match FPackageFileSummary in any way

        // low 32 bits of ARCHIVE_V2_HEADER_TAG are == PACKAGE_FILE_TAG
        if (packageFileTag.CompressedSize == PACKAGE_FILE_TAG)
        {
            // v1 header, not swapped
            bHeaderWasValid = true;
        }
        else if (packageFileTag.CompressedSize == PACKAGE_FILE_TAG_SWAPPED ||
                    packageFileTag.CompressedSize == this.BYTESWAP_ORDER64(PACKAGE_FILE_TAG))
        {
            // v1 header, swapped
            bHeaderWasValid = true;
            bWasByteSwapped = true;
        }
        else if (packageFileTag.CompressedSize == ARCHIVE_V2_HEADER_TAG ||
                    packageFileTag.CompressedSize == this.BYTESWAP_ORDER64(ARCHIVE_V2_HEADER_TAG))
        {
            // v2 header
            bHeaderWasValid = true;
            bWasByteSwapped = (packageFileTag.CompressedSize != ARCHIVE_V2_HEADER_TAG);
            bReadCompressionFormat = true;

            // read CompressionFormatToDecode
            //FCompressionUtil.SerializeCompressorName(this, ref compressionFormatToDecode);
            throw new Error("NotImplementedException");
        }
        else
        {
            throw new Error("ParserException : BulkData compressed header read error. This package may be corrupt!");
        }

        // we should not be in this cas
        // if (!bReadCompressionFormat)
        // {
        //     // upgrade old flag method
        //     if (flags.HasFlag(COMPRESS_DeprecatedFormatFlagsMask))
        //     {
        //         Log.Warning("Old style compression flags are being used with FAsyncCompressionChunk, please update any code using this!");
        //         //compressionFormatToDecode = FCompression.GetCompressionFormatFromDeprecatedFlags(flags);
        //         throw new NotImplementedException();
        //     }
        // }

        // we should not be in this cas
        // // CompressionFormatToDecode came from disk, need to validate it :
        // if (!Enum.TryParse(compressionFormatToDecode, out CompressionMethod compressionFormat))
        // {
        //     throw new ParserException(this, "BulkData compressed header read error. This package may be corrupt!\nCompressionFormatToDecode not found : " + compressionFormatToDecode);
        // }

        // Read in base summary, contains total sizes :
        var summary = this.ReadFCompressedChunkInfo();

        if (bWasByteSwapped)
        {
            summary.CompressedSize = this.BYTESWAP_ORDER64(summary.CompressedSize);
            summary.UncompressedSize = this.BYTESWAP_ORDER64(summary.UncompressedSize);
            packageFileTag.UncompressedSize = this.BYTESWAP_ORDER64(packageFileTag.UncompressedSize);
        }


        // Handle change in compression chunk size in backward compatible way.
        var loadingCompressionChunkSize = packageFileTag.UncompressedSize;
        if (loadingCompressionChunkSize == PACKAGE_FILE_TAG)
        {
            loadingCompressionChunkSize = LOADING_COMPRESSION_CHUNK_SIZEn;
        }

        // check Summary.UncompressedSize vs [V,Length] passed in
        // UncompressedSize smaller than length is okay
        if (summary.UncompressedSize > length) throw new Error("ParserException(Archive SerializedCompressed UncompressedSize ("+summary.UncompressedSize+"}) > Length ("+length+"})");
        outPartialReadLength = summary.UncompressedSize;

        // Figure out how many chunks there are going to be based on uncompressed size and compression chunk size.
        var totalChunkCount = Number((summary.UncompressedSize + loadingCompressionChunkSize - 1n) / loadingCompressionChunkSize);

        // Allocate compression chunk infos and serialize them, keeping track of max size of compression chunks used.
        var compressionChunks = new Array(); // Array of totalChunkCount instance of FCompressedChunkInfo 
        var maxCompressedSize = 0n;
        var totalChunkCompressedSize = 0n;
        var totalChunkUncompressedSize = 0n;
        for (var chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex++)
        {
            var chunkInfo = this.ReadFCompressedChunkInfo();
            
            if (bWasByteSwapped)
            {
                chunkInfo.CompressedSize = this.BYTESWAP_ORDER64(chunkInfo.CompressedSize);
                chunkInfo.UncompressedSize = this.BYTESWAP_ORDER64(chunkInfo.UncompressedSize);
            }
            maxCompressedSize = bigIntMax([chunkInfo.CompressedSize, maxCompressedSize]);

            totalChunkCompressedSize += chunkInfo.CompressedSize;
            totalChunkUncompressedSize += chunkInfo.UncompressedSize;

            compressionChunks.push(chunkInfo);
        }

        // verify the CompressionChunks[] sizes we read add up to the total we read
        if (totalChunkCompressedSize != summary.CompressedSize) throw new Error("ParserException: Archive SerializedCompressed TotalChunkCompressedSize ("+totalChunkCompressedSize+"}) != Summary.CompressedSize ("+summary.CompressedSize+")");
        if (totalChunkUncompressedSize != summary.UncompressedSize) throw new Error("ParserException: Archive SerializedCompressed TotalChunkUncompressedSize ("+totalChunkUncompressedSize+") != Summary.UnompressedSize ("+summary.UncompressedSize+")");

        // Set up destination pointer and allocate memory for compressed chunk[s] (one at a time).
        var destPos = 0n;
        var compressedBuffer = Buffer.alloc(Number(maxCompressedSize));

        // Iterate over all chunks, serialize them into memory and decompress them directly into the destination pointer
        for (var chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex++)
        {
            var chunk : FCompressedChunkInfo = compressionChunks[chunkIndex];
            // Read compressed data.
            compressedBuffer = this.Read(0, Number(chunk.CompressedSize));

            // Decompress into dest pointer directly.
            try
            {
                var outputMessage = "";
                var uncompressed = Buffer.alloc(Number(chunk.UncompressedSize))

                OodleDecompress (compressedBuffer, Number(chunk.CompressedSize), uncompressed, Number(chunk.UncompressedSize), outputMessage);
                dest = Buffer.concat([dest, uncompressed]);
            }
            catch (e)
            {
                throw new Error("ParserException : Failed to uncompress data in "+this.Name()+", Error: "+e);
            }

            // And advance it by read amount.
            destPos += chunk.UncompressedSize;
        }
        return dest;
    }


    public ReadFCompressedChunkInfo() : FCompressedChunkInfo {        
        var compressedSize = this.ReadBytes(8);
        var uncompressedSize = this.ReadBytes(8);
    
        return new FCompressedChunkInfo(compressedSize.readBigInt64LE(), uncompressedSize.readBigInt64LE());
    }

    private BYTESWAP_ORDER64(value: bigint) : bigint
    {
        value = ((value << 8n) & 0xFF00FF00FF00FF00n) | ((value >> 8n) & 0x00FF00FF00FF00FFn);
        value = ((value << 16n) & 0xFFFF0000FFFF0000n) | ((value >> 16n) & 0x0000FFFF0000FFFFn);
        return (value << 32n) | (value >> 32n);
    }
} 


