#!/usr/bin/env bash

while true
do
	node main.js localhost 32021
	if [ $? == 0 ]; then
		echo "Peacefully quit."
		break
	fi
	echo "Restarting robot..."
	sleep 2s
done	
