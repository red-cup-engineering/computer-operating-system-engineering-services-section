#!/bin/sh
# Keeps order-7 (512 KiB) contiguous blocks free for WSL's hv_sock rings.
# Every new Windows<->Linux channel (each wsl.exe or interop launch, each VS Code or Codex spawn)
# allocates its vmbus ring as one order-7 block. Under agent load memory fragments until none is
# free: hvs_probe fails ("page allocation failure: order:7"), UtilAcceptVsock times out, and
# Windows powers the VM off. Proactive compaction alone did not prevent this on 2026-10-09.
# This watcher compacts on demand when the free count falls below the floor, and drops clean
# page cache as a second step when compaction alone does not restore it.
#
#   wsl-hvsock-headroom-guard <min-order7-blocks> <interval-seconds> <drop-caches:yes|no>
set -u
min=${1:-32}; interval=${2:-5}; drop=${3:-yes}

# Free blocks able to hold an order-7 allocation, counted in order-7 units, over all zones.
free7() {
  awk '{ s = 0; for (o = 7; o <= 10; o++) { c = $(o + 5); if (c != "") s += c * 2 ^ (o - 7) } t += s } END { print t + 0 }' /proc/buddyinfo
}

while :; do
  before=$(free7)
  if [ "$before" -lt "$min" ]; then
    echo 1 > /proc/sys/vm/compact_memory
    after=$(free7)
    if [ "$after" -lt "$min" ] && [ "$drop" = yes ]; then
      sync
      echo 1 > /proc/sys/vm/drop_caches
      echo 1 > /proc/sys/vm/compact_memory
      final=$(free7)
      echo "order-7 free ${before} < ${min}: compacted to ${after}; dropped clean page cache and compacted to ${final}"
    else
      echo "order-7 free ${before} < ${min}: compacted to ${after}"
    fi
  fi
  sleep "$interval"
done
