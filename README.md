# Technologie chmurowe zadanie 2
## Piotr Zalewski I1S6 TI 6.2

### Opis zadania:

Zadanie polega na opracowaniu kompletnego potoku CI/CD (pipeline) w usłudze GitHub Actions, który w sposób automatyczny i bezpieczny:
1. Buduje wieloarchitekturowy obraz kontenera aplikacji pogodowej (opracowanej w Zadaniu nr 1) dla platform `linux/amd64` oraz `linux/arm64`.
2. Wykorzystuje zaawansowany mechanizm pamięci podręcznej (cache) w trybie `max` z eksporterem typu `registry`, przechowując dane cache w dedykowanym, publicznym repozytorium na koncie DockerHub (`pzlab33`).
3. Realizuje paradygmat Shift-Left Security poprzez wykonanie automatycznego testu podatności (CVE). Obraz zostaje przesłany do oficjalnego rejestru GitHub Container Registry (ghcr.io) tylko i wyłącznie wtedy, gdy skaner nie wykryje zagrożeń o statusie Krytycznym (CRITICAL) lub Wysokim (HIGH).

### 1. Struktura projektu w repozytorium:

Potok wymaga ścisłej struktury katalogów, aby GitHub Actions poprawnie zidentyfikował plik definicji workflow:
```text
.
├── .github/
│   └── workflows/
│       └── pipeline.yml       # Plik konfiguracyjny GitHub Actions
├── Dockerfile_zadanie_nr_1    # Bezpieczny plik Dockerfile (Hardened, non-root)
├── server.js                  # Kod źródłowy aplikacji w Node.js
└── README.md                  # Opis wykonania zadania
```

### 2. Inicjalizacja repozytorium Git z poziomu terminala:

Repozytorium Git zainicjalizowano następującymi poleceniami wykonanymi w katalogu projektu:
```bash
# Inicjalizacja nowego repozytorium Git
git init

# Zmiana domyślnej nazwy głównej gałęzi na 'main'
git branch -M main

# Dodanie wszystkich plików do śledzenia
git add .

# Utworzenie pierwszego commita
git commit -m "Wstępny commit - baza pod zadanie 2"

# Utworzenie publicznego zdalnego repozytorium i automatyczny push kodu za pomocą gh CLI
gh repo create zadanie2 --public --source=. --remote=origin --push
```

### 3. Konfiguracja środowiska, zmiennych i sekretów:

Poniższe polecenia służą do interaktywnego skonfigurowania w środowisku niezbędnych zmiennych i sekretów (uniknięcie zapisywania wrażliwych danych w historii powłoki):
```bash
# Ustawienie jawnej zmiennej z nazwą użytkownika DockerHub
gh variable set DOCKERHUB_USERNAME

# Bezpieczne ustawienie ukrytego tokenu dostępowego (PAT) do DockerHub
gh secret set DOCKERHUB_TOKEN
```

### 4. Wyzwolenie potoku za pomocą Git Tags:

Zgodnie z konfiguracją sekcji on: `push: tags: - 'v*'`, potok uruchamia się automatycznie po wykryciu nowego tagu wersji:
```bash
# Nadanie tagu wersji zgodnego ze schematem SemVer
git tag v1.0.0

# Wypchnięcie tagu na serwer GitHub (To wyzwala mechanizm GitHub Actions)
git push origin v1.0.0
```

### 5. Przyjęty schemat tagowania i pamięć podręczna (Cache):

W potoku zastosowano następujący schemat nadawania tagów dla obrazów:
* `vX.Y.Z` (np. `v1.0.0`) – wersjonowanie zgodne z zasadami **Semantic Versioning (SemVer)**. Pozwala łatwo kontrolować wersje wydań aplikacji.
* `sha-7-znaków` (np. `sha-e6dd510`) – unikalny skrót commita z Gita. Gwarantuje niezmienność obrazu i pozwala sprawdzić, z której dokładnie poprawki kodu powstał kontener.
* `latest` – zawsze wskazuje na najnowszą, stabilną wersję aplikacji.
* `pzlab33/zadanie2-cache:latest` – dedykowany tag przeznaczony wyłącznie na dane pamięci podręcznej.

> **Uzasadnienie użycia cache w trybie `mode=max`:**
> Domyślny tryb cache w Dockerze (`min`) zapisuje tylko warstwy końcowego obrazu. Użycie parametru `mode=max` zmusza system BuildKit do zapisania na DockerHubie warstw **wszystkich etapów pośrednich**. Dzięki temu podczas kolejnych uruchomień potoku czas budowania skraca się nawet o 70%, ponieważ maszyna nie musi powtarzać raz wykonanych kroków.

### 6. Wybór skanera CVE — Dlaczego Trivy?

Do automatycznego testu podatności (bezpieczeństwa) wybrano skaner Trivy zamiast narzędzia Docker Scout z dwóch powodów:
1. **Licencja Open Source i brak zewnętrznych zależności:** Trivy jest narzędziem w pełni otwartoźródłowym (Open Source), które wykonuje skanowanie w 100% lokalnie na maszynie wirtualnej GitHub Actions. W przeciwieństwie do Docker Scout, Trivy nie posiada limitów dotyczących liczby skanowanych projektów w darmowym planie, nie wymaga rejestracji konta na zewnętrznych platformach SaaS ani generowania komercyjnych tokenów API. Publiczna baza podatności CVE jest pobierana automatycznie i bezpłatnie w trakcie działania potoku.
2. **Bramka bezpieczeństwa (Quality Gate):** Dzięki konfiguracji parametrów `exit-code: '1'` oraz `severity: 'CRITICAL,HIGH'`, Trivy natychmiast przerywa działanie całego potoku, jeśli wykryje istotne luki w bezpieczeństwie. Zgodnie z zasadą *Shift-Left Security*, niesprawdzony lub niebezpieczny obraz **nigdy nie zostanie wypchnięty** do rejestru `ghcr.io`.

### 7. Jak działa potok CI/CD (Krok po kroku):

Cały proces w pliku `pipeline.yml` wykonuje się w następującej sekwencji:
1. **Przygotowanie:** Pobranie kodu źródłowego, konfiguracja emulatora QEMU (niezbędnego do budowania na architekturę `arm64`) oraz systemu Docker Buildx.
2. **Logowanie:** Bezpieczne logowanie do rejestrów DockerHub (dla cache) oraz GitHub Container Registry (`ghcr.io`).
3. **Budowanie testowe:** Obraz jest najpierw budowany szybko tylko dla platformy `amd64` i ładowany lokalnie (`load: true`) do pamięci maszyny potoku. Pobierany jest też istniejący cache z DockerHuba.
4. **Skanowanie Trivy:** Zbudowany lokalnie obraz trafia do skanera Trivy. Jeśli test CVE wykaże krytyczne błędy — potok się zatrzymuje.
5. **Budowanie końcowe i push:** Jeśli skanowanie zakończy się sukcesem, Buildx buduje ostateczny obraz dla obu architektur (`amd64` oraz `arm64`), nadaje mu wygenerowane tagi, wysyła do `ghcr.io` i aktualizuje cache na DockerHubie (`mode=max`).

### 8. Potwierdzenie poprawności działania (Weryfikacja):

Działanie łańcucha zostało przetestowane poprzez nadanie i wypchnięcie tagu `v1.0.0`:
1. **Zakładka Actions:** Potok wykonał się bezbłędnie (wszystkie etapy mają zielony status). Krok Trivy nie zablokował budowania, ponieważ obraz bazowy Alpine okazał się bezpieczny.
2. **GitHub Packages (ghcr.io):** Na koncie GitHub w sekcji *Packages* pojawił się gotowy publiczny obraz, obsługujący jednocześnie dwie architektury (`linux/amd64` oraz `linux/arm64`) oznaczony tagami `v1.0.0`, `latest` oraz `sha-...`.
3. **DockerHub Cache:** Na koncie DockerHub w repozytorium `pzlab33/zadanie2-cache` zostały pomyślnie zapisane warstwy cache, które przyspieszą każde kolejne uruchomienie potoku.
