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

## Docker
I implement it but not tested yet.

Check Makefile to get the targets.

# TODO
## Find the bug on decompress
Line 37 of oodledecompress.ts return 0 and only the 7th first bytes of the uncompressed buffer. (and they are correct)

## Check memory usage
