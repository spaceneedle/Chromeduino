Chromeduino code --- 
The chrome app uses the serial API on the chrome browser to program AVR arduinos with a serial bootloader that is avrdude compatible (Arduino Uno, Mega, etc).
It is a (limited) Arduino IDE and uses a server to compile (since i was not crazy enough to write a javascript port of a GCC cross compiler for 8bit AVR)
