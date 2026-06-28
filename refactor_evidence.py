import re

def refactor():
    with open('src/pages/workspace/Evidence.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add imports
    imports = """
import {
  subscribeToEvidence,
  uploadEvidenceFile,
  deleteEvidence,
  updateEvidence,
  toggleEvidenceFavorite,
  toggleEvidencePinned,
  setEvidenceTags,
  saveEvidenceNote,
  appendEvidenceActivity,
  EvidenceRecord,
  EvidenceFileType,
  EvidenceCategory,
  EvidenceFolder,
  EvidenceOcrStatus,
  EvidenceTag,
  EvidencePage,
  EvidenceVersion,
  EvidenceActivityItem,
  EvidenceNote
} from '../../services/evidenceService';
import { auth } from '../../firebase';
"""
    content = content.replace("import { motion, AnimatePresence } from 'motion/react';", "import { motion, AnimatePresence } from 'motion/react';" + imports)

    # 2. Replace type definitions
    types_start = content.find("type FileType =")
    types_end = content.find("interface EvidenceProps")
    
    new_types = """
type FileType = EvidenceFileType;
type FileCategory = EvidenceCategory;
type FolderName = EvidenceFolder;
type OcrStatus = EvidenceOcrStatus;
type FileTag = EvidenceTag;
type FilePage = EvidencePage;
type FileVersion = EvidenceVersion;
type FileActivityItem = EvidenceActivityItem;
type FileNote = EvidenceNote;
type CaseFile = EvidenceRecord;
"""
    content = content[:types_start] + new_types + "\n" + content[types_end:]

    # 3. Remove MOCK_FILES array
    mock_start = content.find("const MOCK_FILES: CaseFile[] = [")
    mock_end = content.find("// ─── Sub-components", mock_start)
    content = content[:mock_start] + content[mock_end:]

    # 4. Update the Component start
    comp_start = content.find("const Evidence: React.FC<EvidenceProps> = ({ caseTitle = 'Sharma vs. State of UP' }) => {")
    comp_end = content.find("useEffect(() => {", comp_start)
    
    new_comp_start = """const Evidence: React.FC<EvidenceProps> = ({ caseTitle = 'Sharma vs. State of UP' }) => {
  const currentCaseId = caseTitle.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'default-case';
  const [files, setFiles] = useState<CaseFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<CaseFile | null>(null);
  const [selectedPage, setSelectedPage] = useState<FilePage | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<FolderName>>(
    new Set(['Documents', 'Evidence', 'Petitions', 'Affidavits'])
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('explorer');
  const [dragActive, setDragActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [rightTab, setRightTab] = useState<'ai' | 'timeline' | 'versions' | 'notes' | 'tags' | 'properties' | 'share'>('ai');
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeToEvidence(currentCaseId, (data) => {
      setFiles(data);
      setIsLoading(false);
      
      setSelectedFile(prev => {
        if (!prev && data.length > 0) return data[0];
        if (prev) {
          const updated = data.find(f => f.evidenceId === prev.evidenceId);
          return updated || (data.length > 0 ? data[0] : null);
        }
        return null;
      });
      
      setSelectedPage(prev => {
        if (!prev && data.length > 0) return data[0].pages[0] || null;
        return prev;
      });
    });
    return () => unsub();
  }, [currentCaseId]);
"""
    content = content[:comp_start] + new_comp_start + content[comp_end:]
    
    # Remove the old useEffect that had setTimeout
    old_effect = """  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(t);
  }, []);"""
    content = content.replace(old_effect, "")

    # 5. Fix `id` and `status` access
    content = re.sub(r'\b(f|file|selectedFile)\.id\b', r'\1.evidenceId', content)
    content = re.sub(r'\b(f|file|selectedFile)\.status\b', r'\1.ocrStatus', content)

    # 6. Replace Handlers
    handlers_start = content.find("const toggleFavorite = (id: string, e: React.MouseEvent) => {")
    handlers_end = content.find("const currentPageIndex =", handlers_start)
    
    new_handlers = """
  const toggleFavorite = async (evidenceId: string, e: React.MouseEvent, isFav: boolean) => {
    e.stopPropagation();
    await toggleEvidenceFavorite(evidenceId, !isFav);
  };

  const removeFile = async (evidenceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteEvidence(evidenceId);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const user = auth.currentUser;
    const userId = user?.uid || 'anonymous';
    const uploadedBy = user?.displayName || user?.email || 'Current User';

    Array.from(fileList).forEach(async (f, idx) => {
      const id = `upload-${Date.now()}-${idx}`;
      setUploadProgress(prev => ({ ...prev, [id]: 0 }));
      try {
        await uploadEvidenceFile({
          file: f,
          caseId: currentCaseId,
          userId,
          uploadedBy,
          onProgress: (bytesTransferred, totalBytes) => {
            setUploadProgress(prev => ({ ...prev, [id]: (bytesTransferred / totalBytes) * 100 }));
          }
        });
      } catch (err) {
        console.error('Upload failed', err);
      } finally {
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
  };

  const updateNote = async (content: string) => {
    if (!selectedFile) return;
    await saveEvidenceNote(selectedFile.evidenceId, { ...selectedFile.note, content, savedAt: new Date().toLocaleString('en-IN') });
  };

  const toggleTag = async (tag: FileTag) => {
    if (!selectedFile) return;
    const updatedTags = selectedFile.tags.includes(tag) ? selectedFile.tags.filter(t => t !== tag) : [...selectedFile.tags, tag];
    await setEvidenceTags(selectedFile.evidenceId, updatedTags);
  };
"""
    content = content[:handlers_start] + new_handlers + content[handlers_end:]

    # Fix bulkDelete
    bulk_start = content.find("const bulkDelete = () => {")
    bulk_end = content.find("const toggleFavorite =", bulk_start)
    new_bulk = """  const bulkDelete = async () => {
    for (const evidenceId of selectedIds) {
      await deleteEvidence(evidenceId);
    }
    setSelectedIds(new Set());
  };
"""
    content = content[:bulk_start] + new_bulk + content[bulk_end:]

    # 7. Update Explorer View condition
    content = content.replace(
        "{viewMode === 'explorer' && files.length > 0 && (",
        "{viewMode === 'explorer' && files.length > 0 && selectedFile && selectedPage && ("
    )

    # 8. Fix toggleFavorite calls in render
    content = content.replace("onFavorite={e => toggleFavorite(f.id, e)}", "onFavorite={e => toggleFavorite(f.evidenceId, e, f.isFavorite)}")
    content = content.replace("onClick={e => toggleFavorite(file.id, e)}", "onClick={e => toggleFavorite(file.evidenceId, e, file.isFavorite)}")
    content = content.replace("onClick={e => toggleFavorite(selectedFile.id, e)}", "onClick={e => toggleFavorite(selectedFile.evidenceId, e, selectedFile.isFavorite)}")
    
    # Remove file call
    content = content.replace("onClick={e => removeFile(file.id, e)}", "onClick={e => removeFile(file.evidenceId, e)}")
    
    # 9. Fix some optional chaining for selectedPage and selectedFile in render if needed
    content = content.replace("const currentPageIndex = selectedFile.pages", "const currentPageIndex = selectedFile?.pages")
    content = content.replace("const canGoPrev = currentPageIndex > 0;", "const canGoPrev = currentPageIndex !== undefined && currentPageIndex > 0;")
    content = content.replace("const canGoNext = currentPageIndex < selectedFile.pages.length - 1;", "const canGoNext = currentPageIndex !== undefined && selectedFile && currentPageIndex < selectedFile.pages.length - 1;")

    # Also fix selectedFile.tags, selectedFile.activity etc
    content = content.replace("const rightTabs: Array", """
  if (!selectedFile || !selectedPage) {
     // Wait for selectedFile to populate
  }
  const rightTabs: Array""")

    # 10. Write back
    with open('src/pages/workspace/Evidence.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

refactor()
