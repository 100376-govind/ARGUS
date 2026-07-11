export interface IMediaService {
  /**
   * Uploads raw media file data and returns a signed Firebase Storage access URL.
   * @param fileBuffer The binary content of the file
   * @param fileName Unique destination filename
   * @param mimeType Mime-type e.g., image/jpeg, audio/wav
   */
  uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string>;
  
  /**
   * Generates a short-lived download URL for an existing file path.
   */
  getSignedUrl(filePath: string): Promise<string>;
}
