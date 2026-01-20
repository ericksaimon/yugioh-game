#include <windows.h>
#include <cstdint>
#include <cstdio>
#include <cstring>

using OCG_DUEL = void*;

int main(){
  puts("probe2: start");

  HMODULE core = LoadLibraryA("./ocgcore.dll");
  printf("probe2: LoadLibrary=%p\n", (void*)core);
  if(!core){
    printf("probe2: LoadLibrary falhou GetLastError=%lu\n", GetLastError());
    return 1;
  }

  void* pCreate  = (void*)GetProcAddress(core, "OCG_CreateDuel");
  void* pDestroy = (void*)GetProcAddress(core, "OCG_DestroyDuel");
  printf("probe2: pCreate=%p pDestroy=%p\n", pCreate, pDestroy);
  if(!pCreate || !pDestroy){
    puts("probe2: exports faltando");
    return 1;
  }

  // tentativa: int CreateDuel(void** out, const void* options)
  using CreateC = int (__cdecl *)(OCG_DUEL* out_duel, const void* options);
  using Destroy = void (__cdecl *)(OCG_DUEL duel);

  auto createC = (CreateC)pCreate;
  auto destroy = (Destroy)pDestroy;

  alignas(16) unsigned char options[256];
  std::memset(options, 0, sizeof(options));

  OCG_DUEL duel = nullptr;
  puts("probe2: chamando CreateC(&duel, options_zerado) ...");
  int rc = createC(&duel, options);
  printf("probe2: rc=%d duel=%p\n", rc, duel);

  if(duel){
    puts("probe2: destruindo duel...");
    destroy(duel);
  } else {
    puts("probe2: duel NULL (nao destruindo)");
  }

  puts("probe2: end");
  return 0;
}
