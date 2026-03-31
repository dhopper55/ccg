import { FieldError, useFormContext } from 'react-hook-form';
import { getFileExtension, getFileIcon } from 'lib/utils';
import FileDropZone from 'components/base/FileDropZone';

interface UploadedFile {
  id: string;
  filename: string;
  time: string;
  addedBy: string;
  file: File;
  image?: string;
  icon?: string;
}

interface Attachments {
  attachments: UploadedFile[];
}

const createAttachmentFromFile = (file: File): UploadedFile => {
  const isImage = file.type.startsWith('image/');
  const ext = getFileExtension(file.name).toLowerCase();
  return {
    id: `${file.name}-${Date.now()}`,
    filename: file.name,
    time: new Date().toISOString().slice(0, 19),
    addedBy: 'Sampro',
    file,
    ...(isImage && { image: URL.createObjectURL(file) }),
    ...(!isImage && { icon: getFileIcon(ext) }),
  };
};

const FileUploadArea = () => {
  const {
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<Attachments>();

  const files = watch('attachments') || [];
  const uploadedOnly = files.filter((a): a is UploadedFile & { file: File } => Boolean(a.file));

  const onDrop = (acceptedFiles: File[]) => {
    const uploadedFiles = acceptedFiles.map(createAttachmentFromFile);
    setValue('attachments', [...uploadedFiles, ...files], { shouldValidate: true });
  };

  const removeImage = (dropZoneIndex: number) => {
    const removed = uploadedOnly[dropZoneIndex];
    if (!removed) return;
    if (removed.image && removed.image.startsWith('blob:')) {
      URL.revokeObjectURL(removed.image);
    }
    setValue(
      'attachments',
      files.filter((a) => a.id !== removed.id),
      { shouldValidate: true },
    );
  };

  return (
    <FileDropZone
      multiple
      defaultFiles={uploadedOnly.map((a) => a.file)}
      accept={{
        'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.avif', '.webp'],
        'video/*': ['.mp4', '.mov'],
        'application/pdf': ['.pdf'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        'application/msword': ['.doc'],
        'application/zip': ['.zip'],
      }}
      onDrop={onDrop}
      onRemove={removeImage}
      error={(errors?.attachments as FieldError)?.message}
      previewType="thumbnail"
      sx={{ px: { xs: 0, md: 2 }, height: { xs: 'auto', md: 60 } }}
    />
  );
};

export default FileUploadArea;
