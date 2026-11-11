# Corpus local de contraseñas

`common-passwords.sha256` contiene 10.001 huellas SHA-256 únicas derivadas de
[SecLists / 10k-most-common.txt](https://github.com/danielmiessler/SecLists/blob/master/Passwords/Common-Credentials/10k-most-common.txt),
descargado el 10/11/2026. El archivo original tenía SHA-256
`68782d6a4a19a4768d5f15dd66bd534e7a33055cc755411e33f16d18c50fdcce`.
Se aplicó NFC, minúsculas y UTF-8 antes de SHA-256. La licencia MIT está en
`SecLists-LICENSE.txt`. `common-passwords.txt` añade ejemplos largos comunes.

La lista es una defensa local limitada, no una consulta exhaustiva de todas las
filtraciones. El operador puede ampliarla con
`siare.password.blocklist-file=/ruta/corpus.sha256`, con una huella SHA-256
por línea y la misma normalización. Una ruta configurada inválida impide el
arranque. No se envían contraseñas a terceros ni se registran en logs.
