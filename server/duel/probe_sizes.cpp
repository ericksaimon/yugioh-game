#include <windows.h>
#include <cstdint>
#include <cstdio>
#include <cstring>

using OCG_DUEL = void*;

using CreateDuel  = int  (__cdecl *)(OCG_DUEL* out_duel, const void* options);
using DestroyDuel = void (__cdecl *)(OCG_DUEL duel);

int main() {
  puts("probe_sizes: start");

  HMODULE core = LoadLibraryA("./ocgcore.dll");
  printf("probe_sizes: LoadLibrary=%p\n", (void*)core);
  if(!core) {
    printf("LoadLibrary falhou GetLastError=%lu\n", GetLastError());
    return 1;
  }

  auto createDuel  = (CreateDuel)GetProcAddress(core, "OCG_CreateDuel");
  auto destroyDuel = (DestroyDuel)GetProcAddress(core, "OCG_DestroyDuel");
  printf("probe_sizes: create=%p destroy=%p\n", (void*)createDuel, (void*)destroyDuel);
  if(!createDuel || !destroyDuel) {
    puts("probe_sizes: exports faltando");
    return 1;
  }

  alignas(16) unsigned char opt[256];

  for(unsigned int sz = 4; sz <= 128; sz += 4) {
    std::memset(opt, 0, sizeof(opt));
    std::memcpy(opt, &sz, sizeof(sz)); // hipótese: 1º campo = size

    OCG_DUEL duel = nullptr;
    int rc = createDuel(&duel, opt);

    printf("size=%3u -> rc=%d duel=%p\n", sz, rc, duel);

    if(duel) {
      destroyDuel(duel);
      puts("probe_sizes: SUCESSO (criou duel).");
      return 0;
    }
  }

  puts("probe_sizes: nenhum size criou duel.");
  return 0;
}
