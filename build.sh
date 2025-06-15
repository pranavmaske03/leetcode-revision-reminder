#!/bin/bash

# Define timestamp function
timestamp() {
  date +"[%Y-%m-%d %H:%M:%S]"
}

# Go to the current working directory 

cd /home/arjun/Projects/leetcode-reminder/reminder || exit 1

# Compile the program

g++ -std=c++17 -Wall revision_notifier.cpp -o revision_notifier

# If compilation successful, run the program

if [ $? -eq 0 ]; then
	echo "$(timestamp) Compilation successful."
	echo "$(timestamp) Running revision_notifier..."
	./revision_notifier
	echo "$(timestamp) revision_notifier finished running."
else 
	echo "$(timestamp) Build failed..."
fi
