---
description: Zrealizuj jeden etap z docs/ROADMAP.md (np. /etap M1)
argument-hint: "[M0|M1|M2|M3|M4|M5]"
---

Realizujemy etap $ARGUMENTS z `docs/ROADMAP.md`.

1. Przeczytaj `CLAUDE.md`, opis etapu $ARGUMENTS w `docs/ROADMAP.md` i potrzebne skille z `.claude/skills/`.
2. Sprawdź, czy poprzednie etapy są skończone (kod, testy). Jeśli nie, powiedz, czego brakuje, i przerwij.
3. Pokaż plan: pliki do utworzenia i zmiany, migracje, testy, komendy. Maksymalnie 15 punktów. **Poczekaj na zgodę.**
4. Po zgodzie zbuduj etap. Zasady z `CLAUDE.md` (multi-tenant, RLS, klucze na serwerze, MockProvider) są obowiązkowe.
5. Uruchom testy i spełnij kryteria odbioru etapu.
6. Podsumuj po polsku w 5–8 punktach: co zrobione, jak to sprawdzić, co zostało w `docs/PYTANIA.md`, co w następnym etapie. Zaproponuj treść commita.
