from pathlib import Path
import shutil

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "fixtures" / "robustness-v2" / "pdfs"


DOCUMENTS = {
    "scan_0047.pdf": [
        [
            "ACUERDO DE SERVICIOS - copia sintetica",
            "En Vigo, a tres de febrero de dos mil veinticinco.",
            "La referencia interna que comparten las partes es ALQ-77-Z.",
            "Intervienen BRUMA TALLERES SL como prestadora y NORA VEGA como clienta.",
            "El precio principal pactado asciende a novecientos ochenta euros (980,00 EUR).",
            "No consta en esta pagina numero de procedimiento.",
        ],
        [
            "CONDICIONES ECONOMICAS DE ALQ-77-Z",
            "Al vencimiento, el total previsto en la copia asciende a 1.145,50 EUR.",
            "El vencimiento se fijo para el 15 de marzo de 2025.",
            "Esta segunda hoja remite a la primera para identificar a las partes.",
        ],
    ],
    "recibido.pdf": [
        [
            "ESCRITO PRESENTADO POR PARTE - copia sintetica",
            "Registro de entrada: 14/04/2025.",
            "Estas actuaciones se identifican como PZA-731/2025 y se vinculan con ALQ-77-Z.",
            "BRUMA TALLERES SL afirma que NORA VEGA mantiene una obligacion impagada.",
            "Lo anterior constituye una alegacion de parte, no un reconocimiento judicial.",
        ],
        [
            "DETALLE DE LA PRETENSION",
            "La demandante cuantifica su pretension en 1.490,70 EUR.",
            "BRUMA TALLERES SL sostiene que esa suma sigue pendiente.",
            "La cifra se formula dentro del escrito de parte y queda sujeta a comprobacion.",
        ],
    ],
    "resumen_09.pdf": [
        [
            "CERTIFICACION DE ESTADO - copia sintetica",
            "Expedida el 18 de abril de 2025 respecto de PZA-731/2025.",
            "La certificacion indica que las actuaciones constaban cerradas en ese momento.",
            "Referencia relacionada: acuerdo ALQ-77-Z.",
        ]
    ],
    "doc-final2.pdf": [
        [
            "AUTO - copia sintetica",
            "Fecha de firma: 2025-04-18.",
            "En PZA-731/2025, el organo examina el acuerdo ALQ-77-Z.",
            "El auto ordena mantener abiertas las actuaciones mientras se revisan los originales.",
            "Esta indicacion contradice la certificacion de estado emitida en la misma fecha.",
        ]
    ],
    "anexo-copia.pdf": [
        [
            "PROVIDENCIA - copia sintetica",
            "Vigo, 22 abr. 2025.",
            "Actuaciones PZA-731/2025.",
            "Se requiere exclusivamente a BRUMA TALLERES SL para que aporte la factura completa dentro de siete dias.",
            "El plazo no se dirige a NORA VEGA.",
            "La referencia contractual relacionada es ALQ-77-Z.",
        ]
    ],
    "sin_nombre.pdf": [
        [
            "NOTA DE RECEPCION - copia sintetica",
            "No figura una fecha inequivoca en este papel.",
            "El papel menciona PZA-731/2025 y el acuerdo ALQ-77-Z.",
            "Se alude a un anexo de entregas, pero dicho anexo no consta entre los archivos recibidos.",
            "Sin ese anexo no es posible afirmar el saldo resultante.",
        ]
    ],
    "papel_82.pdf": [
        [
            "DEMANDA DE CANTIDAD - copia sintetica",
            "Presentada el 7 de mayo de 2024.",
            "La parte identifica los autos como RVB-204/2024.",
            "LITORAL SUMINISTROS SL afirma que NORA VEGA incumplio el pago convenido.",
            "La afirmacion procede de la demandante y no equivale a una deuda reconocida.",
        ],
        [
            "DESGLOSE ALEGADO POR LA PARTE ACTORA",
            "La parte actora reclama un total de EUR 2,720.00.",
            "Del total, 420,00 euros corresponden, segun la actora, a interes de demora.",
            "Ambas cifras son pretensiones de LITORAL SUMINISTROS SL.",
        ],
    ],
    "resuelto.pdf": [
        [
            "SENTENCIA - copia sintetica",
            "Firmada el 09.10.2024.",
            "La resolucion corresponde a RVB-204/2024.",
            "El tribunal estima parcialmente la peticion y rechaza los conceptos no acreditados.",
        ],
        [
            "FALLO Y ESTADO",
            "La cantidad finalmente reconocida queda fijada en 2.300,00 EUR.",
            "Con esta resolucion el procedimiento queda cerrado.",
            "No se deduce de esta pagina ningun plazo nuevo para NORA VEGA.",
        ],
    ],
    "decision-anterior.pdf": [
        [
            "COMUNICACION POSTERIOR - copia sintetica",
            "Fecha de salida: 11-X-2024.",
            "La comunicacion se refiere a RVB-204/2024.",
            "El escrito menciona una hoja de liquidacion, pero la hoja no acompana la copia.",
            "Sin esa hoja no puede verificarse ninguna cifra residual.",
        ]
    ],
}


def draw_standard_page(pdf, filename, page_number, total_pages, lines):
    width, height = A4
    pdf.setFillColor(HexColor("#18324A"))
    pdf.rect(0, height - 64, width, 64, fill=1, stroke=0)
    pdf.setFillColor(HexColor("#FFFFFF"))
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(44, height - 38, "EXPEDIENTE VIVO - DOCUMENTO SINTETICO")
    pdf.setFont("Helvetica", 8)
    pdf.drawRightString(width - 44, height - 38, filename)

    y = height - 108
    for index, line in enumerate(lines):
        if index == 0:
            pdf.setFillColor(HexColor("#18324A"))
            pdf.setFont("Helvetica-Bold", 14)
            pdf.drawString(48, y, line)
            y -= 34
            pdf.setStrokeColor(HexColor("#B5C7D6"))
            pdf.line(48, y + 14, width - 48, y + 14)
        else:
            pdf.setFillColor(HexColor("#202B33"))
            pdf.setFont("Helvetica", 10)
            pdf.drawString(48, y, line)
            y -= 24

    pdf.setFillColor(HexColor("#667784"))
    pdf.setFont("Helvetica", 8)
    pdf.drawString(48, 34, "Datos ficticios para evaluacion tecnica.")
    pdf.drawRightString(width - 48, 34, f"Pagina {page_number} de {total_pages}")


def write_document(filename, pages):
    target = OUTPUT_DIR / filename
    pdf = canvas.Canvas(str(target), pagesize=A4, pageCompression=1)
    pdf.setTitle(filename)
    pdf.setAuthor("Expediente Vivo - synthetic fixture")
    for page_number, lines in enumerate(pages, start=1):
        draw_standard_page(pdf, filename, page_number, len(pages), lines)
        pdf.showPage()
    pdf.save()


def write_degraded_page():
    target = OUTPUT_DIR / "folio_borroso.pdf"
    width, height = A4
    pdf = canvas.Canvas(str(target), pagesize=A4, pageCompression=1)
    pdf.setTitle("folio_borroso.pdf")
    pdf.setFillColor(Color(0.94, 0.94, 0.92))
    pdf.rect(0, 0, width, height, fill=1, stroke=0)
    pdf.setStrokeColor(Color(0.78, 0.78, 0.75))
    for offset in range(90, 720, 44):
        pdf.line(70, offset, width - 65, offset + 5)
    pdf.setFillColor(Color(0.55, 0.55, 0.53))
    pdf.setFont("Courier", 8)
    pdf.drawString(112, 520, "RVB ? 204")
    pdf.drawString(305, 471, "importe ?")
    pdf.showPage()
    pdf.save()


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, pages in DOCUMENTS.items():
        write_document(filename, pages)
    write_degraded_page()
    shutil.copyfile(OUTPUT_DIR / "anexo-copia.pdf", OUTPUT_DIR / "otro_nombre.pdf")
    print(f"Generated 11 synthetic PDFs in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
