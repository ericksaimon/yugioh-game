#include <windows.h>
#include <cstdint>
#include <cstdio>

using OCG_DUEL = void*;

int main(){
  puts("probe: start");

  HMODULE core = LoadLibraryA("./ocgcore.dll");
  printf("probe: LoadLibrary=%p\n", (void*)core);
  if(!core){
    printf("probe: LoadLibrary falhou GetLastError=%lu\n", GetLastError());
    return 1;
  }

  void* pCreate  = (void*)GetProcAddress(core, "OCG_CreateDuel");
  void* pDestroy = (void*)GetProcAddress(core, "OCG_DestroyDuel");
  void* pStart   = (void*)GetProcAddress(core, "OCG_StartDuel");
  printf("probe: pCreate=%p pDestroy=%p pStart=%p\n", pCreate, pDestroy, pStart);

  if(!pCreate){
    puts("probe: Create nao encontrado");
    return 1;
  }

  // A) retorna ponteiro
  using CreateA = OCG_DUEL (__cdecl *)(uint32_t);
  // B) retorna int e preenche ponteiro
  using CreateB = int (__cdecl *)(OCG_DUEL*, uint32_t);

  auto createA = (CreateA)pCreate;
  auto createB = (CreateB)pCreate;

  puts("probe: tentando CreateA(0) ...");
  OCG_DUEL dA = createA(0);
  printf("probe: CreateA retornou %p\n", dA);

  puts("probe: tentando CreateB(&dB, 0) ...");
  OCG_DUEL dB = nullptr;
  int rB = createB(&dB, 0);
  printf("probe: CreateB retornou rB=%d dB=%p\n", rB, dB);

  puts("probe: fim (nao destruindo duels).");
  return 0;
}
