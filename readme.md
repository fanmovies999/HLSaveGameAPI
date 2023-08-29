# Description
Get SQLite file from HL savegame.

# Inspiration
https://github.com/klukule/SaveFileParseAPI

https://github.com/SparkyTD/UnrealEngine.Gvas

https://github.com/FabianFG/CUE4Parse

# SDK
oodle lib from UnrealSDK.

# How to test ?
## checkout the code
```
mkdir ~/dev
cd ~/dev

git clone https://github.com/fanmovies999/HLSaveGameAPI.git
```
## create savegame folder
```
mkdir ~/dev/savegame

cp XXX.sav  ~/dev/savegame/HL-01-00.sav
```

## Tests 
### Use make <target> to run next tasks
* prepare : to install dependencies
* run_server: to start the server in the current console
* test: to execute curl to call the api. (in another console)

```
cd ~/dev/HLSaveGameAPI
make prepare
make run_server
...
make test
```

### In vscode
* Open the folder ~/dev/HLSaveGameAPI
* Go to Debug
* Start "Lauch program"
* In a console, execute make test.
```
cd ~/dev/HLSaveGameAPI
make test
```

### In vscode with lldb (extension CodeLLDB from Vadim Chugunov)
* Open the folder ~/dev/HLSaveGameAPI
* Go to Debug
* Start "Lauch lldb"
* In a console, execute make test.
```
cd ~/dev/HLSaveGameAPI
make test
```

## Docker
I implement it but not tested yet.

Check Makefile to get the targets.

# TODO
## Find the bug on decompress
Line 37 of oodledecompress.ts return 0 and only the 7th first bytes of the uncompressed buffer. (and they are correct)

Using lldb, C# application (https://github.com/fanmovies999/SaveFileParseAPI) shows
```
OodleLZ_Decompress about to DecodeSome, starting at comp 0 -> raw 0
CHUNK header @ 0  , compressor 8=Kraken reset 
QH : 131072 , 13054 , 00000000
OodleLZ_Decompress about to DecodeSome, starting at comp 0 -> raw 0
CHUNK header @ 0  , compressor 8=Kraken reset 
QH : 131072 , 24355 , 00000000
...
```

And node application (this repos)
```
OodleLZ_Decompress about to DecodeSome, starting at comp 0 -> raw 0
CHUNK header @ 0  , compressor 8=Kraken reset 
QH : 131072 , 13054 , 00000000
OODLE ERROR : corruption : invalid excess stream
OODLE ERROR : LZ corruption : DecodeOneQuantum fail!
OODLE ERROR : LZ corruption : OodleLZ_Decompress failed (0 != 131072)
```

The 3 first line are the same, but the Oodle generates an issue.




## Check memory usage
