#include <windows.h>
#include <cstdint>
#include <cstdio>
#include <cstdlib>

using OCG_DUEL = void*;

using fpOCG_CreateDuel     = int  (__cdecl *)(OCG_DUEL* out_duel, uint32_t seed);
using fpOCG_DestroyDuel    = void (__cdecl *)(OCG_DUEL duel);

template <typename T>
T must_get(HMODULE h, const char* name) {
  FARPROC p = GetProcAddress(h, name);
  if(!p) {
    std::printf("ERRO: GetProcAddress falhou para %s\n", name);
    std::exit(1);
  }
  return reinterpret_cast<T>(p);
}

int main() {
  std::puts("Create/Destroy smoke test...");

  HMODULE core = LoadLibraryA("./ocgcore.dll");
  if(!core) {
    std::puts("ERRO: nao consegui carregar ./ocgcore.dll");
    return 1;
  }

  auto OCG_CreateDuel  = must_get<fpOCG_CreateDuel>(core, "OCG_CreateDuel");
  auto OCG_DestroyDuel = must_get<fpOCG_DestroyDuel>(core,"OCG_DestroyDuel");

  OCG_DUEL duel = nullptr;
  int cret = OCG_CreateDuel(&duel, 0);
  std::printf("OCG_CreateDuel retornou %d, duel=%p\n", cret, duel);

  if(!duel) {
    std::puts("ERRO: duel veio NULL");
    FreeLibrary(core);
    return 1;
  }

  std::puts("Destruindo duel...");
  OCG_DestroyDuel(duel);

  std::puts("FreeLibrary...");
  FreeLibrary(core);

  std::puts("OK: sem crash.");
  return 0;
}
