import { FArchive } from './farchive.js';
import { LOADING_COMPRESSION_CHUNK_SIZE } from './constants.js';
import { Buffer } from 'node:buffer';

export class FArchiveLoadCompressedProxy extends FArchive {
    private readonly _compressedData: Buffer;
    private _currentIndex: number;
    private readonly _tmpData: Buffer;
    private _tmpDataPos: number;
    private _tmpDataSize: number;
    private _shouldSerializeFromArray: boolean;
    private _rawBytesSerialized: number;

    /**
     * Constructor
     * 
     * @param {string} name - Name of the savegame file.
     * @param {Buffer} compressedData - Buffer that contains the compressed data.
     */
    constructor(name: string, compressedData: Buffer) {
        super(name);

        this._compressedData = compressedData;

        this._tmpData = Buffer.alloc(LOADING_COMPRESSION_CHUNK_SIZE);
        this._tmpDataPos = LOADING_COMPRESSION_CHUNK_SIZE;
        this._tmpDataSize = LOADING_COMPRESSION_CHUNK_SIZE;

        this._currentIndex = 0;
        this._shouldSerializeFromArray = false;
        this._rawBytesSerialized = 0;
    }


    public override Read(offset: number, count: number): Buffer {
        var dstData = Buffer.alloc(count);

        if (this._shouldSerializeFromArray)
        {
            // SerializedCompressed reads the compressed data from here
            this._compressedData.copy(dstData, 0, this._currentIndex, this._currentIndex + count -1 );
            this._currentIndex += count;
            return dstData;
        }
        // Regular call to serialize, read from temp buffer
        else
        {
            var dstPos = 0;
            while (count > 0)
            {
                var bytesToCopy = Math.min(count, this._tmpDataSize - this._tmpDataPos);
                // Enough room in buffer to copy some data.
                if (bytesToCopy > 0)
                {
                    dstData = Buffer.concat([dstData, this._tmpData.subarray(this._tmpDataPos, bytesToCopy)]);
                    dstPos += bytesToCopy;
                    count -= bytesToCopy;
                    this._tmpDataPos += bytesToCopy;
                    this._rawBytesSerialized += bytesToCopy;
                }
                // Tmp buffer fully exhausted, decompress new one.
                else
                {
                    // Decompress more data. This will call Serialize again so we need to handle recursion.
                    this.DecompressMoreData();

                    if (this._tmpDataSize == 0)
                    {
                        // wanted more but couldn't get any
                        // avoid infinite loop
                        throw new Error("ParserException");
                    }
                }
            }
        }

        return dstData;    
    }

    private DecompressMoreData() 
    {
        // This will call Serialize so we need to indicate that we want to serialize from array.
        this._shouldSerializeFromArray = true;
        this._tmpData.copy(this.SerializeCompressedNew(LOADING_COMPRESSION_CHUNK_SIZE));
        // last chunk will be partial :
        //	all chunks before last should have size == LOADING_COMPRESSION_CHUNK_SIZE
        this._shouldSerializeFromArray = false;
        // Buffer is filled again, reset.
        this._tmpDataPos = 0;
        this._tmpDataSize = this._tmpData.length;
    }

}
