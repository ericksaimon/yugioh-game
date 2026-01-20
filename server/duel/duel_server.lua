print("Teste globals do ocgcore (32-bit)")

package.cpath = package.cpath .. ";./?.dll;../../ocgcore/?.dll"
package.path  = package.path  .. ";./scripts/?.lua;../../ocgcore/scripts/?.lua"

local ok, ocg = pcall(require, "ocgcore")
print("require ok?", ok, "tipo:", type(ocg))
if not ok then
  print("erro:", ocg)
  return
end

print("Duel global:", type(_G.Duel))
print("Card global:", type(_G.Card))
print("Effect global:", type(_G.Effect))
print("Group global:", type(_G.Group))

if type(_G.Duel) == "table" and type(_G.Duel.Create) == "function" then
  local duel = _G.Duel.Create(0)
  print("Duel criado:", duel)
else
  print("Duel.Create NÃO encontrado em _G.Duel")
end
