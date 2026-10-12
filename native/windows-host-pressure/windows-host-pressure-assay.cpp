#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include "windows-host-pressure.h"
#include <windows.h>
#include <array>
#include <cstdio>
#include <cwchar>

// SDK assay on an ephemeral Windows runner. This is not host custody or authority.
int main() {
 HP_HANDLE missing=reinterpret_cast<HP_HANDLE>(1);
 if(HostPressureOpen(nullptr,0,&missing)!=ERROR_INVALID_PARAMETER || missing) return 1;
 wchar_t windows[MAX_PATH]{},volume[64]{};
 if(!GetWindowsDirectoryW(windows,MAX_PATH) || wcslen(windows)<3 || windows[1]!=L':') return 2;
 wchar_t root[4]{windows[0],L':',L'\\',0};
 if(!GetVolumeNameForVolumeMountPointW(root,volume,64)) return 3;
 const wchar_t* roots[]{volume,volume};
 missing=reinterpret_cast<HP_HANDLE>(1);
 if(HostPressureOpen(roots,2,&missing)!=ERROR_INVALID_PARAMETER || missing) return 4;
 HP_HANDLE handle=nullptr;
 const auto opened=HostPressureOpen(roots,1,&handle);
 if(opened!=ERROR_SUCCESS || !handle){std::fprintf(stderr,"native open failed: %lu\n",opened);return 5;}
 struct Close {HP_HANDLE handle;~Close(){HostPressureClose(handle);}} close{handle};
 std::array<char,8193> bytes{};size_t length=123;
 auto result=HostPressureRead(handle,bytes.data(),bytes.size(),&length);
 if(result!=ERROR_INVALID_PARAMETER || length || bytes[0]) return 6;
 bytes[0]='x';length=123;
 result=HostPressureRead(nullptr,bytes.data(),8192,&length);
 if(result!=ERROR_INVALID_PARAMETER || length || bytes[0]) return 7;
 result=HostPressureRead(handle,bytes.data(),1,&length);
 if(result!=ERROR_INSUFFICIENT_BUFFER || length || bytes[0]) {
  std::fprintf(stderr,"bounded read failed: %lu\n",result);return 8;
 }
 result=HostPressureRead(handle,bytes.data(),8192,&length);
 if(result!=ERROR_SUCCESS || !length || length>=8192 || bytes[length]) {
  std::fprintf(stderr,"native sample failed: %lu\n",result);return 9;
 }
 if(std::fwrite(bytes.data(),1,length,stdout)!=length) return 10;
 return 0;
}
