## [Check Out the Version 3 Beta!](https://duino.app)

## About

The chrome app uses the serial API on the chrome browser to program AVR arduinos with a serial bootloader that is avrdude compatible (Arduino Uno, Mega, etc).
It is a (limited) Arduino IDE and uses a server to compile (since I (spaceneedle) was not crazy enough to write a javascript port of a GCC cross compiler for 8bit AVR)

## Buy Us a Coffee

The point of this project, currently, is to provide a free option for people to program an arduino with a chromebook. (like in an educational setting), Thus we will not charge for it.

Saying that, this project is large and takes a lot of coffee to develop, not to mention the cost of hosting the compiling servers, if you'd like to buy us a coffee or two, you can use the button bellow to donate to the developers:

[![Tip A Coffee](https://i.imgur.com/NUOSLzv.png)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=J5NT7UVN3B76J&item_name=Coding+Open+Source+Projects&currency_code=AUD&source=url)

## Run Your Own Compile Server

### Linux

Make sure you have the latest node.js installed.

 1. `git clone https://github.com/spaceneedle/Chromeduino.git`
 2. `cd "Chromeduino/Chromeduino Server"`
 3. `npm install`
 4. check install with `ls`, if there is *no* folder called `arduino-1.8.5` then run `curl https://downloads.arduino.cc/arduino-1.8.5-linux64.tar.xz | tar -xJ`
 5. `node app`
 6. go to `http://localhost:3000/version`
 
You can change the port in the config.json.
 
### Windows
Wipe and install linux.
 
### Share the Love <3
 
If you have a dev VPS or something lying around, why not help the community and run a public compile server on it. (You can also add some shameless self promotion in the description)
 
 1. Make sure you have pm2 installed `npm i pm2 -g`
 2. Launch the server with pm2 `pm2 start app.js -n chromeduino`
 3. Make it run on startup `pm2 save` and `pm2 startup` read the output of those commands.
 4. Edit the server.json file with your compile server's details and then submit a pull request. If you are unsure how to do that, post an issue with the details and we'll do it for you.


### Notice of Non-Affiliation and Disclaimer:
We are not affiliated, associated, authorized, endorsed by, or in any way officially connected with Arduino AG or Google LLC (“Google”), or any of their subsidiaries or their affiliates. The official Arduino AG website can be found at https://www.arduino.cc
The names "Chrome", "Chromebook", "Chromebox", "Arduino", and "Genuino" as well as related names, marks, emblems and images are registered trademarks of their respective owners.