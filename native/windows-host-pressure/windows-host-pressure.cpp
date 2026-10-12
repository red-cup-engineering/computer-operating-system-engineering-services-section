#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#define PSAPI_VERSION 2
#define HOST_PRESSURE_BUILD
#include "windows-host-pressure.h"
#include <windows.h>
#include <psapi.h>
#include <pdh.h>
#include <pdhmsg.h>
#include <bcrypt.h>
#include <algorithm>
#include <array>
#include <charconv>
#include <cmath>
#include <cstring>
#include <cwchar>
#include <limits>
#include <memory>
#include <string>
#include <system_error>
#include <vector>
namespace {
constexpr unsigned long long safe=9007199254740991ULL;
struct State { PDH_HQUERY query=nullptr; PDH_HCOUNTER disk=nullptr; std::string host,epoch; std::vector<std::wstring> roots;
 ~State(){if(query)PdhCloseQuery(query);} };
bool guid(const std::wstring& s){if(s.size()!=36)return false;for(size_t i=0;i<s.size();i++){
 if(i==8||i==13||i==18||i==23){if(s[i]!=L'-')return false;}
 else if(!((s[i]>=L'0'&&s[i]<=L'9')||(s[i]>=L'a'&&s[i]<=L'f')||(s[i]>=L'A'&&s[i]<=L'F')))return false;}return true;}
std::string ascii(const std::wstring& s){std::string out;for(wchar_t c:s){if(c>127)return {};out+=c>=L'A'&&c<=L'Z'?static_cast<char>(c+32):static_cast<char>(c);}return out;}
std::string quote(const std::string& s){std::string out="\"";for(char c:s){if(c=='\\'||c=='"')out+='\\';out+=c;}return out+'"';}
bool volume(const std::wstring& s){return s.size()==49&&s.substr(0,11)==L"\\\\?\\Volume{"&&s.substr(47)==L"}\\"&&guid(s.substr(11,36));}
bool bytes(SIZE_T count,SIZE_T size,unsigned long long& out){if(!size||count>safe/size)return false;out=static_cast<unsigned long long>(count)*size;return true;}
unsigned long identity(State& s){
 wchar_t machine[64]{};DWORD length=static_cast<DWORD>(sizeof(machine));
 LSTATUS e=RegGetValueW(HKEY_LOCAL_MACHINE,L"SOFTWARE\\Microsoft\\Cryptography",L"MachineGuid",RRF_RT_REG_SZ|RRF_SUBKEY_WOW6464KEY,nullptr,machine,&length);
 if(e!=ERROR_SUCCESS)return static_cast<unsigned long>(e);
 const size_t n=wcsnlen_s(machine,64);if(n==64||!guid(std::wstring(machine,n)))return ERROR_INVALID_DATA;
 s.host="windows-machine:"+ascii(std::wstring(machine,n));
 std::array<unsigned char,16> nonce{};if(BCryptGenRandom(nullptr,nonce.data(),static_cast<ULONG>(nonce.size()),BCRYPT_USE_SYSTEM_PREFERRED_RNG)<0)return ERROR_GEN_FAILURE;
 constexpr char hex[]="0123456789abcdef";for(auto c:nonce){s.epoch+=hex[c>>4];s.epoch+=hex[c&15];}return ERROR_SUCCESS;
}
unsigned long read(State& s,std::string& out){
 const ULONGLONG start=GetTickCount64();FILETIME ft{};GetSystemTimePreciseAsFileTime(&ft);
 ULARGE_INTEGER ticks{};ticks.LowPart=ft.dwLowDateTime;ticks.HighPart=ft.dwHighDateTime;
 constexpr unsigned long long offset=116444736000000000ULL;
 if(ticks.QuadPart<offset)return ERROR_INVALID_DATA;
 const auto at=(ticks.QuadPart-offset)/10000ULL;
 PERFORMANCE_INFORMATION info{};info.cb=static_cast<DWORD>(sizeof(info));
 if(!GetPerformanceInfo(&info,static_cast<DWORD>(sizeof(info))))return GetLastError();
 if(info.CommitTotal>info.CommitLimit||info.PhysicalAvailable>info.PhysicalTotal)return ERROR_INVALID_DATA;
 unsigned long long ram=0,commit=0;
 if(!bytes(info.PhysicalAvailable,info.PageSize,ram)||!bytes(info.CommitLimit-info.CommitTotal,info.PageSize,commit))return ERROR_ARITHMETIC_OVERFLOW;
 PDH_STATUS e=PdhCollectQueryData(s.query);if(e!=ERROR_SUCCESS)return static_cast<unsigned long>(e);
 PDH_FMT_COUNTERVALUE q{};e=PdhGetFormattedCounterValue(s.disk,PDH_FMT_DOUBLE,nullptr,&q);if(e!=ERROR_SUCCESS)return static_cast<unsigned long>(e);
 if((q.CStatus!=PDH_CSTATUS_VALID_DATA&&q.CStatus!=PDH_CSTATUS_NEW_DATA)||!std::isfinite(q.doubleValue)||q.doubleValue<0)return ERROR_INVALID_DATA;
 std::string volumes;
 for(const auto& root:s.roots){
  if(GetDriveTypeW(root.c_str())!=DRIVE_FIXED)return ERROR_NOT_SUPPORTED;
  ULARGE_INTEGER available{},total{},free{};
  if(!GetDiskFreeSpaceExW(root.c_str(),&available,&total,&free))return GetLastError();
  const auto room=std::min(available.QuadPart,free.QuadPart);if(room>safe)return ERROR_ARITHMETIC_OVERFLOW;
  if(!volumes.empty())volumes+=',';volumes+="{\"id\":"+quote(ascii(root))+",\"freeBytes\":"+std::to_string(room)+"}";
 }
 const auto elapsed=GetTickCount64()-start;if(elapsed>1000||at==0||at>safe)return ERROR_TIMEOUT;
 char number[64]{};const auto f=std::to_chars(number,number+63,q.doubleValue,std::chars_format::general,std::numeric_limits<double>::max_digits10);
 if(f.ec!=std::errc{})return ERROR_INVALID_DATA;*f.ptr=0;
 out="{\"kind\":\"windows.host-pressure\",\"physicalHost\":"+quote(s.host)+",\"epoch\":"+quote(s.epoch)+",\"observedAt\":"+std::to_string(at)
 +",\"sampleElapsedMs\":"+std::to_string(elapsed)+",\"availableMemoryBytes\":"+std::to_string(ram)+",\"availableCommitBytes\":"+std::to_string(commit)
 +",\"volumes\":["+volumes+"],\"diskQueueLength\":"+number+",\"counterStatus\":"+std::to_string(q.CStatus)+"}";
 return out.size()<8192?ERROR_SUCCESS:ERROR_INSUFFICIENT_BUFFER;
}
}
extern "C" unsigned long HostPressureOpen(const wchar_t* const* roots,size_t count,HP_HANDLE* out){
 if(!out)return ERROR_INVALID_PARAMETER;*out=nullptr;if(!roots||!count||count>8)return ERROR_INVALID_PARAMETER;
 try {auto s=std::make_unique<State>();for(size_t i=0;i<count;i++){
  if(!roots[i])return ERROR_INVALID_PARAMETER;const size_t n=wcsnlen_s(roots[i],64);if(n==64)return ERROR_INVALID_PARAMETER;
  const std::wstring root(roots[i],n);if(!volume(root)||GetDriveTypeW(root.c_str())!=DRIVE_FIXED)return ERROR_NOT_SUPPORTED;
  if(std::any_of(s->roots.begin(),s->roots.end(),[&](const auto& r){return ascii(r)==ascii(root);}))return ERROR_INVALID_PARAMETER;s->roots.push_back(root);
 }auto e=identity(*s);if(e!=ERROR_SUCCESS)return e;
 PDH_STATUS p=PdhOpenQueryW(nullptr,0,&s->query);if(p!=ERROR_SUCCESS)return static_cast<unsigned long>(p);
 p=PdhAddEnglishCounterW(s->query,L"\\PhysicalDisk(_Total)\\Current Disk Queue Length",0,&s->disk);if(p!=ERROR_SUCCESS)return static_cast<unsigned long>(p);
 p=PdhCollectQueryData(s->query);if(p!=ERROR_SUCCESS)return static_cast<unsigned long>(p);
 *out=s.release();return ERROR_SUCCESS;}catch(...){return ERROR_NOT_ENOUGH_MEMORY;}
}
extern "C" unsigned long HostPressureRead(HP_HANDLE handle,char* out,size_t capacity,size_t* length){
 if(length)*length=0;if(out&&capacity)out[0]=0;
 if(!handle||!out||!length||!capacity||capacity>8192)return ERROR_INVALID_PARAMETER;
 try{std::string wire;const auto e=read(*static_cast<State*>(handle),wire);if(e!=ERROR_SUCCESS)return e;
 if(wire.size()+1>capacity)return ERROR_INSUFFICIENT_BUFFER;
 std::memcpy(out,wire.c_str(),wire.size()+1);*length=wire.size();return ERROR_SUCCESS;}catch(...){return ERROR_NOT_ENOUGH_MEMORY;}
}
extern "C" void HostPressureClose(HP_HANDLE handle){delete static_cast<State*>(handle);}
