# Setzen der AK in SWT

*Legacy Note: Teilfunktionen dieser Toolsammlung wurden unterdessen direkt ins DSJ-Turnierportal integriert.*

Dieses Tool setzt das Feld *Land*, *Info1*, oder ein anderes für jeden Teilnehmenden in einer SWT-Datei auf das korrekte Altersklassenkürzel, z.B. `U12` oder `W16`.

```sh
> node bin/set-altersklasse.js --input=/tmp/in.SWT --out=/tmp/out.SWT --field=2035
```

`--field=2035` setzt die Altersklasse im Feld `2035` gemäß der [SWT-structure-files](https://github.com/fnogatz/SWT-structure-files).
