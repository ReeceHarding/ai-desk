# Web Scraper Documentation

## Overview
The web scraper is a Python-based tool designed to extract content and information from websites. It uses Selenium WebDriver for dynamic content handling and supports parallel processing for efficient scraping. The scraper creates both XML and CSV outputs of the scraped data.

## Key Features
- Dynamic content handling with Selenium
- Parallel processing for multiple pages
- Email extraction with context detection
- Expandable content support (dropdowns, FAQs)
- Structured XML output
- CSV export for emails
- Duplicate prevention
- Domain normalization

## File Structure
```
scraper/
├── scraper.py           # Main scraper script
├── output/
│   ├── *_data.xml      # XML output with all scraped content
│   └── *_emails.csv    # CSV file with extracted emails
```

## Components

### 1. WebDriver Setup (`setup_driver`)
- Configures Chrome WebDriver with Selenium
- Sets up headless mode and browser options
- Handles automation detection avoidance
- Sets appropriate timeouts and window size

### 2. Link Discovery (`get_all_links`)
- Extracts links from multiple page sections:
  - Header navigation
  - Footer links
  - Main content
  - Menu items
- Handles iframe content
- Removes duplicate links
- Normalizes URLs

### 3. Dynamic Content Handling (`expand_dynamic_content`)
- Expands dropdown menus
- Opens FAQ accordions
- Handles collapsible sections
- Manages multiple expansion attempts
- Includes scroll-into-view functionality

### 4. Email Extraction (`extract_emails`)
- Regular expression patterns for email detection
- Handles obfuscated email formats
- Determines email context based on surrounding text
- Categories:
  - Contact Email
  - Booking Email
  - Support Email
  - Information Email
- Prevents duplicate entries

### 5. Content Scraping (`scrape_single_page`)
- Extracts page title
- Captures main content
- Processes both visible text and page source
- Handles dynamic content loading
- Error handling and recovery

### 6. Parallel Processing (`scrape_website`)
- Multi-threaded page processing
- Configurable thread pool
- Shared resource management
- Progress tracking
- Domain-specific filtering

### 7. Output Generation
#### XML Output (`build_xml`)
- Structured content organization
- Metadata inclusion
- Page-specific information
- Email associations
- Pretty-printed formatting

#### CSV Output (`save_emails_to_csv`)
- Email address listing
- Source URL tracking
- Context information
- CSV formatting

## Usage

### Basic Usage
```python
if __name__ == "__main__":
    start_url = "https://example.com"
    output_xml = "example_data.xml"
    output_csv = "example_emails.csv"
    
    scraped_data = scrape_website(start_url)
    build_xml(scraped_data, output_xml)
    save_emails_to_csv(output_csv)
```

### Configuration Options
- `max_depth`: Control scraping depth (default: 1)
- `num_threads`: Parallel processing threads (default: 4)
- `timeout`: Page load timeout (default: 30 seconds)
- Skip patterns for unwanted content

## Output Format

### XML Structure
```xml
<website domain="example.com" date_scraped="YYYY-MM-DD HH:MM:SS">
  <summary>
    <total_pages>N</total_pages>
    <total_emails>M</total_emails>
  </summary>
  <pages>
    <page>
      <url_info>
        <full_url>https://example.com/page</full_url>
        <path>/page</path>
      </url_info>
      <title>Page Title</title>
      <content>Page Content</content>
      <emails>
        <email>
          <address>email@example.com</address>
          <context>Contact Email</context>
        </email>
      </emails>
    </page>
  </pages>
</website>
```

### CSV Structure
```csv
email,url,context
email@example.com,https://example.com/contact,Contact Email
```

## Dependencies
- selenium
- beautifulsoup4
- webdriver_manager
- requests
- xml.etree.ElementTree
- concurrent.futures

## Error Handling
- Stale element handling
- Timeout management
- Dynamic content failures
- Network errors
- Invalid URL handling

## Best Practices
1. Respect robots.txt
2. Implement rate limiting
3. Handle session management
4. Clean up resources
5. Validate output data
6. Monitor memory usage
7. Log errors appropriately

## Limitations
- JavaScript-dependent content may require additional handling
- Some dynamic content might not be accessible
- Rate limiting may affect performance
- Memory usage with large sites
- Network dependency

## Future Improvements
1. Enhanced email pattern recognition
2. Better context detection
3. Additional output formats
4. Improved error recovery
5. Configuration file support
6. Custom scraping rules
7. API integration options 