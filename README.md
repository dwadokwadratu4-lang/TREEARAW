# 🌲 System Monitoringu Świerka 3D / WebAR (Cyfrowy Bliźniak)

Interaktywny symulator oraz cyfrowy bliźniak (**Digital Twin**) systemu monitoringu fizjologii i środowiska świerka pospolitego, działający w przeglądarce w trybie **3D** oraz **Rozszerzonej Rzeczywistości (WebAR)** na znaczniku **HIRO**.

🔗 **Uruchom aplikację na żywo (Live Demo):** [https://vercel.app](https://vercel.app)

---

## 🎯 Główne funkcje projektu

* **10-kanałowy pierścień telemetryczny 3D („NASA dla drzewa”):** Lewitujące wokół korony tablice pomiarowe z wykresami na żywo, wartościami bieżącymi, dobowymi minimami i maksimami oraz kartą statusu zdrowotnego drzewa i odliczaniem do ryzyka ataku kornika.
* **Dwukierunkowa inspekcja (Tablice ↔ Czujniki i ESP32):** Kliknięcie wybranej tablicy podświetla odpowiedni kolorowy przewód biegnący do stacji mikrokontrolera **ESP32**, a dotknięcie punktu pomiarowego ustawia kamerę przed właściwym wykresem.
* **Przekrój strefy korzeniowej (10 cm / 60 cm):** Specjalnie wycięty profil glebowy eksponujący podziemny system korzeniowy oraz czujniki wilgotności i temperatury gleby.
* **Edukacyjna wizualizacja Predykcji AI (zakładka INFO):** Trzystopniowa animacja wyjaśniająca proces od **fuzji danych wielosensorowych**, przez **selekcję cech**, aż po **prognozowanie wskazań dendrometru**.
* **Tryb WebAR (znacznik HIRO) i PWA:** Możliwość osadzenia makiety drzewa na płaskim stole przy użyciu kamery smartfona (z blokadą pozycji i obracaniem palcami) oraz instalacji aplikacji na ekranie głównym telefonu (pełny ekran bez paska adresu).

## 🛠️ Technologie

* **Frontend & 3D:** React, TypeScript, Vite, Three.js
* **Rozszerzona Rzeczywistość:** WebAR (śledzenie markera HIRO), PWA (Web App Manifest)
* **Wdrożenie:** GitHub + Vercel

---

## 🇬🇧 English Summary

**Spruce Monitoring System 3D / WebAR (Digital Twin)** is an interactive browser-based IoT & environmental simulation showcasing multi-sensor monitoring of a Norway spruce (dendrometer, bark & air sensors, 10/60 cm soil probes, ESP32 station, and IMGW meteorological feed). 

The application features an orbiting 3D telemetry ring, interactive cable highlighting, an AI prediction explainer (Data Fusion → Feature Selection → Dendrometer Forecasting), and a **WebAR mode (HIRO marker)** with PWA support for mobile devices.

---

## 👤 Autor / Author

**Artur Wierzbicki**  
*Projekt, koncepcja inżynieryjna i realizacja / Concept, Engineering & Development*  
🔗 LinkedIn: [://linkedin.com](https://linkedin.com)

📄 Licencja / License: **MIT**
