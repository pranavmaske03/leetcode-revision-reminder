# Leetcode-Revision-Reminder

LeetCode Revision Reminder is a lightweight tool that helps you revise previously solved LeetCode problems using spaced repetition. It automatically records the problems you solve, stores them locally, and notifies you to revisit them after a set number of days (default: 7 days).

This project is designed to reinforce long-term memory of problem-solving techniques by reminding you to practice problems again before you forget them — making your LeetCode preparation smarter and more consistent.

## Working

***The project is divided into three independent but connected stages,each handling a specific part of the reminder system.***

### 1. Custom Browser extension
### 2. Local Server
### 3. Notification Script

## Custom Browser Extension

- A custom browser extension which only runs on **Leetcode website pages** and detects when problem is succesfully solved.
Once the problem is sucessfully solved or marked as Solved it extracts the **problem number** and **title** from the page.
Sends this data to the local server (`http://localhost:3000/submit`) using a POST request.

- It uses a **MutationObserver** to detect changes in the DOM — specifically looking for a target element that appears only when a problem is solved for the first time.



- For more details on how **MutationObserver** works, [Click here](https://github.com/pranavmaske03/yt-ad-skip/blob/main/notes.md).

## Local Server

- The server is a lightweight Node.js app that listens on **port 3000**.
- It receives problem data from the extension and stores it in a `CSV` file.
- The server runs as a background service using **systemd** to ensure it's always available.
- All CORS requests from `leetcode.com` are allowed, making communication seamless.
- It supports only `POST` requests at the `/submit` route, and handles preflight (`OPTIONS`) requests.

## Notificaton Script

- The notification script is written in **C++** for fast execution.
- It runs at system startup using a crontab that triggers the `build.sh` which runs the actual notification script.
- The C++ program reads the `problems.csv` file and:
  - Compares stored problem dates with the current date.
  - If a problem was solved **exactly 7 days ago**, it triggers a desktop notification.
- `build.sh` ensures the script is compiled and executed properly on every boot.

## Setup instruction

**Note:** This project requires a browser (e.g., Chrome) and a working C++ compiler.

### 1. Clone the repository

    git clone https://github.com/pranavmaske03/leetcode-revision-reminder.git

### 2. Setup Crontab with build.sh path.

Crontab is a command-line utility used to schedule tasks (known as cron jobs) to run automatically at specified times or system events (e.g., system reboot).

It is part of the cron daemon — a time-based job scheduler in Unix-like operating systems.

Run this command on terminal.

    crontab -e

Add the path of the build.sh file at the top of the file.

    @reboot /full/path/to/Leetcode-Revision-Reminder/build.sh

***Save and exit (CTRL+O, then CTRL+X).***

### 3. Setup and Enable the local server as a Systemd Service

Create systemd service file.

    sudo nano /etc/systemd/system/leetcode-server.service

Write the following(update paths accordingly)

    [Unit]
    Description=LeetCode Reminder Local Server
    After=network.target

    [Service]
    ExecStart=/usr/bin/node /full/path/to/Leetcode-Revision-Reminder/server/server.js
    WorkingDirectory=/full/path/to/Leetcode-Revision-Reminder/server
    Restart=always
    StandardOutput=inherit
    StandardError=inherit
    User=your-username
    Environment=NODE_ENV=production

    [Install]
    WantedBy=multi-user.target

Enable the start the service.

    sudo systemctl daemon-reexec
    sudo systemctl daemon-reload
    sudo systemctl enable leetcode-server
    sudo systemctl start leetcode-server

Check the status

    systemctl status leetcode-server

### 4. Set the Extension folder to the browser.

1. Go to chrome://extensions/
2. Enable Developer Mode (top-right corner)
3. Click Load Unpacked
4. Select the extension folder from the cloned repository


## Contributing

If you'd like to contribute, feel free to fork the repo and open a pull request. Bug fixes, improvements, and new ideas are welcome!
