while true; do r=$(( RANDOM % 15)); curl --location 'http://localhost:8080/getRawDatabaseImage' --form "file=@"/home/laurent/Documents/dev/savegame/HL-01-$(printf "%02d" $r).sav"" ; done




https://koffi.dev/start