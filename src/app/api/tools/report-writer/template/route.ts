import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Students");

  // Header row
  sheet.columns = [
    { header: "First Name", key: "firstName", width: 20 },
    { header: "Pronouns", key: "pronouns", width: 14 },
  ];

  // Style header
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF7B2FF2" },
  };
  headerRow.alignment = { horizontal: "center" };

  // Add 30 empty rows with pronoun dropdown validation
  for (let i = 2; i <= 31; i++) {
    sheet.addRow(["", ""]);
    sheet.getCell(`B${i}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"he,she,they"'],
      showErrorMessage: true,
      errorTitle: "Invalid",
      error: "Please select he, she, or they",
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="questerra-report-writer-template.xlsx"',
    },
  });
}
