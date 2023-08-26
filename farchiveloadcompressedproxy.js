"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FArchiveLoadCompressedProxy = void 0;
const farchive_js_1 = require("./farchive.js");
const constants_js_1 = require("./constants.js");
class FArchiveLoadCompressedProxy extends farchive_js_1.FArchive {
    /**
     * Constructor
     *
     * @param {Buffer} compressedData - Buffer that contains the compressed data.
     */
    constructor(compressedData) {
        super();
        this._compressedData = compressedData;
        this._tmpData = Buffer.alloc(constants_js_1.LOADING_COMPRESSION_CHUNK_SIZE);
        this._tmpDataPos = constants_js_1.LOADING_COMPRESSION_CHUNK_SIZE;
        this._tmpDataSize = constants_js_1.LOADING_COMPRESSION_CHUNK_SIZE;
        this._currentIndex = 0;
        this._shouldSerializeFromArray = false;
        this._rawBytesSerialized = 0;
    }
}
exports.FArchiveLoadCompressedProxy = FArchiveLoadCompressedProxy;
/*
class FArchiveLoadCompressedProxy extends FArchive {
    constructor(name, compressedData, compressionFormat, flags = CompressionFlags.COMPRESS_None, versions) {
        super(versions);
        this.Name = name;
        this._compressedData = compressedData;
        this._compressionFormat = compressionFormat;
        this._compressionFlags = flags;
        this._currentIndex = 0;
        this._tmpData = Buffer.alloc(LOADING_COMPRESSION_CHUNK_SIZE);
        this._tmpDataPos = LOADING_COMPRESSION_CHUNK_SIZE;
        this._tmpDataSize = LOADING_COMPRESSION_CHUNK_SIZE;
        this._shouldSerializeFromArray = false;
        this._rawBytesSerialized = 0;
    }

    clone() {
        return new FArchiveLoadCompressedProxy(this.Name, this._compressedData, this._compressionFormat, this._compressionFlags, this.versions);
    }

    read(dstData, offset, count) {
        if (this._shouldSerializeFromArray) {
            // SerializedCompressed reads the compressed data from here
            assert(this._currentIndex + count <= this._compressedData.length);
            this._compressedData.copy(dstData, 0, this._currentIndex, this._currentIndex + count);
            this._currentIndex += count;
            return count;
        } else {
            let dstPos = 0;
            while (count > 0) {
                const bytesToCopy = Math.min(count, this._tmpDataSize - this._tmpDataPos);
                // Enough room in buffer to copy some data.
                if (bytesToCopy > 0) {
                    // We pass in a NULL pointer when forward seeking. In that case we don't want
                    // to copy the data but only care about pointing to the proper spot.
                    if (dstData !== null) {
                        this._tmpData.copy(dstData, dstPos, this._tmpDataPos, this._tmpDataPos + bytesToCopy);
                        dstPos += bytesToCopy;
                    }
                    count -= bytesToCopy;
                    this._tmpDataPos += bytesToCopy;
                    this._rawBytesSerialized += bytesToCopy;
                } else {
                    // Tmp buffer fully exhausted, decompress new one.
                    // Decompress more data. This will call Serialize again so we need to handle recursion.
                    this.decompressMoreData();

                    if (this._tmpDataSize === 0) {
                        // wanted more but couldn't get any
                        // avoid infinite loop
                        throw new Error('ParserException');
                    }
                }
            }

            return dstPos;
        }
    }

    seek(offset, origin) {
        assert(origin === 'begin');
        const currentPos = this.position;
        const difference = offset - currentPos;
        // We only support forward seeking.
        assert(difference >= 0);
        // Seek by serializing data, albeit with NULL destination so it's just decompressing data.
        this.read(null, 0, difference);
        return this.position;
    }

    get canSeek() {
        return true;
    }

    get length() {
        throw new Error('InvalidOperationException');
    }

    get position() {
        return this._rawBytesSerialized;
    }

    set position(value) {
        this.seek(value, 'begin');
    }

    decompressMoreData() {
        // This will call Serialize so we need to indicate that we want to serialize from array.
        this._shouldSerializeFromArray = true;
        const [decompressedLength] = Compression.serializeCompressedNew(
            this._tmpData, LOADING_COMPRESSION_CHUNK_SIZE, this._compressionFormat, this._compressionFlags, false
        );
        // last chunk will be partial :
        // all chunks before last should have size == LOADING_COMPRESSION_CHUNK_SIZE
        assert(decompressedLength <= LOADING_COMPRESSION_CHUNK_SIZE);
        this._shouldSerializeFromArray = false;
        // Buffer is filled again, reset.
        this._tmpDataPos = 0;
        this._tmpDataSize = decompressedLength;
    }
}

module.exports = { FArchiveLoadCompressedProxy };
*/ 
