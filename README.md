# Mój bilans

Osobisty budżet: etat i JDG, limity kategorii, transakcje oraz historia majątku.
Jedno prywatne konto chronione hasłem, dane w PostgreSQL. Aplikacja nie jest programem księgowym: podatki i ZUS wpisujesz według rozliczeń księgowości.

## Wdrożenie na Railway z GitHuba

1. Utwórz prywatne repozytorium GitHub, np. `moj-bilans`. Umieść **zawartość tego folderu bezpośrednio w głównym katalogu repozytorium**, w tym pliki `package.json`, `Dockerfile`, `railway.json` i folder `public`. Nie wysyłaj `.env`, `node_modules` ani danych finansowych. Możesz użyć GitHub → Add file → Upload files, zaznaczając pliki i folder `public` oraz `test`.
2. Na Railway utwórz projekt i dodaj bazę PostgreSQL (New → Database → PostgreSQL).
3. W tym samym projekcie dodaj serwis z GitHuba (New → GitHub Repo) i wskaż repozytorium. Railway wykryje Dockerfile. Pierwszy start bez zmiennych może się nie udać — uzupełnij je poniżej.
4. W serwisie **aplikacji**, w Variables ustaw:

   | Zmienna | Wartość |
   | --- | --- |
   | `DATABASE_URL` | Referencja do `DATABASE_URL` serwisu Postgres: `${{Postgres.DATABASE_URL}}` (dopasuj nazwę serwisu, jeśli jest inna) |
   | `APP_PASSWORD` | Twoje unikalne hasło, co najmniej 16 znaków; ustaw tylko w Railway |
   | `NODE_ENV` | `production` |

5. Zastosuj zmiany i zaczekaj na udany deployment. Aplikacja sama tworzy potrzebne tabele. Nie wymaga ręcznego importowania SQL.
6. Settings → Networking → Generate Domain. Otwórz adres HTTPS i zaloguj się hasłem `APP_PASSWORD`.
7. Dodaj testową transakcję. Odśwież stronę, wyloguj się i zaloguj na drugim urządzeniu — transakcja powinna pozostać. Usuń testowy wpis.

Port aplikacja pobiera z `PORT`, a stan gotowości sprawdza pod `/health`, włącznie z połączeniem do bazy. Dane PostgreSQL są niezależne od kolejnych wdrożeń aplikacji. Nie usuwaj serwisu bazy ani jego dysku. Kopie bazy i ich retencję skonfiguruj osobno w Railway według dostępnych ustawień konta. Eksport JSON w aplikacji pozostaje dodatkową możliwością.

Każdy push do podłączonej gałęzi GitHub uruchamia aktualizację w Railway. Kod nie zawiera haseł ani przykładowych danych użytkownika.

## Przeniesienie wcześniejszych danych

W starej aplikacji pobierz kopię JSON i w nowej wybierz „Wczytaj kopię”. To **zastępuje** obecne dane na serwerze, po potwierdzeniu. Import wykonujesz raz, a potem wszystkie urządzenia korzystają z tej samej bazy. Transakcje, plany i historia majątku zachowują dotychczasowy format.

## Użytkowanie

„Plan miesiąca” → dochody, zobowiązania, oszczędności → kwoty stałe i wagi kategorii → „Oblicz limity” → „Zapisz plan miesiąca”. Każdy wydatek dodawaj jako transakcję. Zmiany automatycznie trafiają do bazy po zatwierdzeniu formularza. Informacja o udanym zapisie pojawia się dopiero po potwierdzeniu serwera.

Przy jednoczesnej edycji na kilku urządzeniach starszy zapis jest odrzucany, aby nie nadpisać nowszych danych. W takiej sytuacji odśwież aplikację i ponownie wprowadź ostatnią zmianę. Przy braku sieci aplikacja zgłasza błąd i wymaga odświeżenia; nie działa w trybie offline. Hasło nie jest zapisywane w przeglądarce. Sesja trwa maksymalnie 7 dni; „Wyloguj się” unieważnia ją w bazie.

Zmiana `APP_PASSWORD` zmienia hasło do nowych logowań; aby zakończyć wszystkie istniejące sesje, usuń wiersze z tabeli `budget_sessions` w bazie (nie usuwaj tabeli danych). Aplikacja jest przeznaczona dla jednej osoby, bez rejestracji i odzyskiwania hasła przez e-mail.

## Lokalnie

Node.js 22 lub nowszy i PostgreSQL. Ustaw zmienne z `.env.example` w swoim środowisku (plik `.env` nie jest automatycznie wczytywany). Uruchom `npm install`, potem `npm start`. W lokalnym HTTP używaj `NODE_ENV=development`; na Railway zawsze `production`, aby ciasteczko sesji wymagało HTTPS.

`npm test` uruchamia testy obsługi API z bazą zastępczą, bez otwierania portów: logowanie, sesje, walidacja danych, zapis i odczyt, konflikty równoległych zmian, pochodzenie żądań i ograniczenie prób logowania. Pełny test z rzeczywistym PostgreSQL i przeglądarką należy wykonać po wdrożeniu. W środowisku przygotowania nie było dostępu do rejestru npm; zależność `pg` jest przypięta do wersji 8.16.3, a zależności pośrednie zostaną rozwiązane podczas budowania na Railway.
