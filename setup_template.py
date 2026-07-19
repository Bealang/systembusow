#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generator i konfigurator nowej strony klienta z szablonu systemu busów.
Uruchomienie: python setup_template.py
"""

import os
import re
import sys

# Katalogi i pliki wykluczone z podmiany
IGNORE_DIRS = {'.git', 'node_modules', 'data', 'uploads', '.agent', '.gemini'}
IGNORE_FILES = {'package-lock.json', 'database.sqlite', 'setup_template.py'}
ALLOWED_EXTENSIONS = {'.ejs', '.js', '.json', '.html', '.css', '.md', '.env', '.env.example'}

def prompt_input(label, default=""):
    prompt_str = f"{label}"
    if default:
        prompt_str += f" [{default}]"
    prompt_str += ": "
    try:
        val = input(prompt_str).strip()
    except (EOFError, KeyboardInterrupt):
        print("\nPrzerwano.")
        sys.exit(0)
    return val if val else default

def format_phone(phone_raw):
    # Usunięcie niepotrzebnych znaków oprócz cyfr i '+'
    digits_only = re.sub(r'[^\d+]', '', phone_raw)
    if not digits_only.startswith('+'):
        digits_only = '+48' + digits_only.lstrip('0')
    
    # Formatowanie wyświetlania: +48 XXX XXX XXX oraz XXX XXX XXX
    body = digits_only[3:] if digits_only.startswith('+48') else digits_only
    if len(body) == 9:
        formatted = f"+48 {body[:3]} {body[3:6]} {body[6:]}"
        body_formatted = f"{body[:3]} {body[3:6]} {body[6:]}"
    else:
        formatted = digits_only
        body_formatted = digits_only
        
    return digits_only, formatted, body_formatted

def main():
    print("\n" + "=" * 65)
    print("   GENERATOR NOWEJ STRONY Z SZABLONU SYSTEMU BUSÓW")
    print("=" * 65)
    print("Podaj dane nowego klienta (naciśnij ENTER, aby użyć wartości domyślnej):\n")

    company_name = prompt_input("1. Nazwa marki/firmy (np. TransBus, JanJan)", "TwojaNazwa")
    
    miejscowosc1 = prompt_input("2. Miejscowość 1 (główna / startowa)", "miejscowosc1")
    miejscowosc2 = prompt_input("3. Miejscowość 2 (docelowa)", "miejscowosc2")
    
    phone_input = prompt_input("4. Numer telefonu (np. 500111222 lub +48500111222)", "+48000000000")
    phone_raw, phone_formatted, phone_body_formatted = format_phone(phone_input)

    street = prompt_input("5. Ulica i numer (np. ul. Przykładowa 1)", "ul. Przykładowa 1")
    postal_code = prompt_input("6. Kod pocztowy (np. 00-000)", "00-000")
    city = prompt_input("7. Miejscowość dla siedziby firmy", miejscowosc1)
    
    nip = prompt_input("8. NIP firmy (tylko cyfry)", "0000000000")
    regon = prompt_input("9. REGON firmy", "000000000")
    
    email_input = prompt_input("10. E-mail kontaktowy (wpisz 'wkrotce' jeśli brak)", "kontakt@twojanazwa-bus.pl")
    email = "wkrotce" if email_input.lower() in ["brak", "wkrotce", "wkrótce"] else email_input
    
    default_domain = f"{company_name.lower()}-bus.pl"
    domain_input = prompt_input(f"11. Domena internetowa (np. {default_domain})", default_domain)

    lata_input = prompt_input("12. Lata działalności (np. 24 lata)", "24 lata")
    lata_formatted = lata_input if ("lat" in lata_input.lower() or "lata" in lata_input.lower()) else f"{lata_input} lat"

    miejsce_biletow = prompt_input("13. Miejsce sprzedaży biletów miesięcznych (np. w dworcowej kasie biletowej / u kierowcy)", "[miejsce-sprzedaży-miesięcznych]")

    full_address = f"{street}, {postal_code} {city}"
    
    # Mapowanie wszystkich szablonowych fraz na nowe wartości
    replacements = [
        # Telefon (dla linku tel:, schema oraz wersji tekstowych)
        ("+48000000000", phone_raw),
        ("+48 000 000 000", phone_formatted),
        ("000 000 000", phone_body_formatted),
        ("+48\n                        000 000 000", phone_formatted),
        ("+48\n 000 000 000", phone_formatted),
        
        # Miejscowości (mała i wielka litera)
        ("miejscowosc1", miejscowosc1),
        ("Miejscowosc1", miejscowosc1.capitalize()),
        ("miejscowosc2", miejscowosc2),
        ("Miejscowosc2", miejscowosc2.capitalize()),
        
        # Nazwa marki i domena
        ("TwojaNazwa-BUS", f"{company_name}-BUS"),
        ("TwojaNazwa BUS", f"{company_name} BUS"),
        ("TwojaNazwa bus", f"{company_name} bus"),
        ("TwojaNazwa", company_name),
        ("twojanazwa-bus.pl", domain_input),
        ("TwojaNazwa-bus.pl", domain_input),
        ("mleczek", company_name),
        
        # Adres i REGON / NIP
        ("ul. Przykładowa 1, 00-000 miejscowosc1", full_address),
        ("ul. Przykładowa 1", street),
        ("00-000", postal_code),
        ("PL0000000000", f"PL{nip}"),
        ("0000000000", nip),
        ("000000000", regon),
        
        # E-mail
        ("kontakt@twojanazwa-bus.pl", email),

        # Lata działalności
        ("[lata] lat", lata_formatted),
        ("[lata]", lata_formatted),
        ("od ponad X lat", f"od ponad {lata_formatted}"),
        ("od ponad 25 lat", f"od ponad {lata_formatted}"),

        # Miejsce sprzedaży biletów miesięcznych
        ("[miejsce-sprzedaży-miesięcznych]", miejsce_biletow),
        ("[miejsce-sprzedazy-miesiecznych]", miejsce_biletow),
        ("[gdzie]", miejsce_biletow),
    ]

    root_dir = os.path.dirname(os.path.abspath(__file__))
    modified_files_count = 0
    total_replacements_count = 0

    print("\n[+] Rozpoczynam podmienianie fraz w plikach szablonu...")

    for current_root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

        for file_name in files:
            if file_name in IGNORE_FILES:
                continue

            ext = os.path.splitext(file_name)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                continue

            file_path = os.path.join(current_root, file_name)
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except UnicodeDecodeError:
                continue
            except Exception as e:
                print(f"[!] Błąd odczytu pliku {file_path}: {e}")
                continue

            new_content = content
            file_replacements = 0

            for old_str, new_str in replacements:
                if old_str in new_content:
                    count = new_content.count(old_str)
                    new_content = new_content.replace(old_str, new_str)
                    file_replacements += count

            if new_content != content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                rel_path = os.path.relpath(file_path, root_dir)
                print(f"  [✓] Zaktualizowano: {rel_path} ({file_replacements} zamian)")
                modified_files_count += 1
                total_replacements_count += file_replacements

    print("\n" + "=" * 65)
    print(f" SUKCES! Zaktualizowano {modified_files_count} plików (łączna liczba zamian: {total_replacements_count}).")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    main()
