@echo off
rem End an RDP visit WITHOUT locking the desktop: hands this session back to the PC's own
rem (headless) console, still logged in, so browser automation keeps working.
rem Use this instead of closing the RDP window. Must run as administrator
rem (right-click > Run as administrator, or make a shortcut with "Run as administrator" ticked).
for /f "skip=1 tokens=3" %%s in ('query user %USERNAME%') do (
  %windir%\System32\tscon.exe %%s /dest:console
)
