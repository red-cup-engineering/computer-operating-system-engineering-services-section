#pragma once
#include <stddef.h>
#ifndef _WIN32
#error Windows target required
#endif
#ifdef HOST_PRESSURE_BUILD
#define HP_API __declspec(dllexport)
#else
#define HP_API __declspec(dllimport)
#endif
#ifdef __cplusplus
extern "C" {
#endif
typedef void* HP_HANDLE;
/* Held by one host owner, serialized; readers joined before close.
 * 1..8 canonical local volume GUIDs from received backing-file custody.
 * No worker handles, timers, processes, traversals or configuration writes. */
HP_API unsigned long HostPressureOpen(const wchar_t* const* roots, size_t count, HP_HANDLE* out);
/* Complete bounded JSON or error; an absent metric never becomes zero.
 * The owner must bound execution externally; elapsed rejection isn't a deadline. */
HP_API unsigned long HostPressureRead(HP_HANDLE handle, char* out, size_t capacity, size_t* length);
HP_API void HostPressureClose(HP_HANDLE handle);
#ifdef __cplusplus
}
#endif
