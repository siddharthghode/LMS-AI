import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

export async function generateCertificatePdf(params: {
  userId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  issuedAt?: Date;
}): Promise<string> {
  const { userId, studentName, courseId, courseTitle, issuedAt = new Date() } = params;

  // Ensure certificates directory exists in uploadDir
  const certDir = path.join(config.uploadDir, 'certificates');
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  const fileName = `cert_${userId}_${courseId}.pdf`;
  const filePath = path.join(certDir, fileName);

  // Create A4 Landscape PDF Document (842 x 595.28 points)
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);
  const { width, height } = page.getSize();

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontTimesRomanItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  // Background Fill (Soft Off-White)
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.98, 0.98, 0.99),
  });

  // Double Outer Border (Navy & Gold Accent)
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: rgb(0.25, 0.32, 0.71), // Indigo
    borderWidth: 4,
  });

  page.drawRectangle({
    x: 32,
    y: 32,
    width: width - 64,
    height: height - 64,
    borderColor: rgb(0.85, 0.65, 0.13), // Gold
    borderWidth: 1.5,
  });

  // Header: Organization Name
  const orgName = 'VERTEXON LEARNING TECHNOLOGIES';
  const orgWidth = fontHelveticaBold.widthOfTextAtSize(orgName, 14);
  page.drawText(orgName, {
    x: (width - orgWidth) / 2,
    y: height - 85,
    size: 14,
    font: fontHelveticaBold,
    color: rgb(0.25, 0.32, 0.71),
  });

  // Certificate Title
  const certTitle = 'CERTIFICATE OF ACHIEVEMENT';
  const titleWidth = fontHelveticaBold.widthOfTextAtSize(certTitle, 28);
  page.drawText(certTitle, {
    x: (width - titleWidth) / 2,
    y: height - 130,
    size: 28,
    font: fontHelveticaBold,
    color: rgb(0.12, 0.16, 0.22),
  });

  // Subtitle
  const subtitle = 'THIS IS PROUDLY PRESENTED TO';
  const subWidth = fontHelvetica.widthOfTextAtSize(subtitle, 11);
  page.drawText(subtitle, {
    x: (width - subWidth) / 2,
    y: height - 175,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.45, 0.52, 0.60),
  });

  // Recipient Name
  const nameText = studentName.toUpperCase();
  const nameWidth = fontHelveticaBold.widthOfTextAtSize(nameText, 32);
  page.drawText(nameText, {
    x: (width - nameWidth) / 2,
    y: height - 235,
    size: 32,
    font: fontHelveticaBold,
    color: rgb(0.18, 0.24, 0.58),
  });

  // Divider Line Under Name
  page.drawLine({
    start: { x: (width - nameWidth) / 2 - 20, y: height - 250 },
    end: { x: (width + nameWidth) / 2 + 20, y: height - 250 },
    color: rgb(0.85, 0.65, 0.13),
    thickness: 2,
  });

  // Description
  const desc = 'for successfully mastering all modules, labs, and graded assessments in';
  const descWidth = fontTimesRomanItalic.widthOfTextAtSize(desc, 15);
  page.drawText(desc, {
    x: (width - descWidth) / 2,
    y: height - 295,
    size: 15,
    font: fontTimesRomanItalic,
    color: rgb(0.3, 0.35, 0.45),
  });

  // Course Title
  const courseText = courseTitle;
  const courseWidth = fontHelveticaBold.widthOfTextAtSize(courseText, 22);
  page.drawText(courseText, {
    x: (width - courseWidth) / 2,
    y: height - 340,
    size: 22,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.12, 0.18),
  });

  // Footer: Date and Verification
  const dateStr = `Issued: ${issuedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  page.drawText(dateStr, {
    x: 80,
    y: 80,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.55),
  });

  const certIdStr = `Certificate ID: LMS-${userId.slice(0, 8)}-${courseId.slice(0, 8)}`;
  const certIdWidth = fontHelvetica.widthOfTextAtSize(certIdStr, 10);
  page.drawText(certIdStr, {
    x: width - certIdWidth - 80,
    y: 80,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.5, 0.55, 0.65),
  });

  // Save PDF bytes to file
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);

  return `/uploads/certificates/${fileName}`;
}
