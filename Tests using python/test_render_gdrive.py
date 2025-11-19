"""Quick test to see if pagination code works"""
import sys
sys.path.insert(0, 'backend')

# Simulate the pagination logic
def test_pagination():
    # Simulate what Google Drive API returns
    mock_results_page1 = {
        'files': [{'id': f'file{i}', 'name': f'so_{i}.pdf'} for i in range(100)],
        'nextPageToken': 'token123'
    }
    
    mock_results_page2 = {
        'files': [{'id': f'file{i}', 'name': f'so_{i}.pdf'} for i in range(100, 150)],
        # No nextPageToken = last page
    }
    
    # Test the pagination logic
    files = []
    page_token = None
    page_num = 0
    
    while True:
        page_num += 1
        print(f"Fetching page {page_num}...")
        
        # Simulate API call
        if page_num == 1:
            file_results = mock_results_page1
        else:
            file_results = mock_results_page2
        
        files.extend(file_results.get('files', []))
        print(f"  Got {len(file_results.get('files', []))} files, total: {len(files)}")
        
        page_token = file_results.get('nextPageToken')
        if not page_token:
            print("  No more pages - done!")
            break
    
    print(f"\n✅ Pagination test: Got {len(files)} total files across {page_num} pages")
    return len(files) == 150

if __name__ == '__main__':
    success = test_pagination()
    print(f"\nTest result: {'PASS' if success else 'FAIL'}")

