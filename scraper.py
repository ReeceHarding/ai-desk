import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urldefrag
import xml.etree.ElementTree as ET
import os
import time
import re
import csv
from concurrent.futures import ThreadPoolExecutor
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException, ElementNotInteractableException
from webdriver_manager.chrome import ChromeDriverManager
from queue import Queue
from threading import Lock
from xml.dom import minidom

# Global variables for thread safety
email_data = []
email_lock = Lock()

def setup_driver():
    """Set up and return a configured Chrome WebDriver"""
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    driver.set_page_load_timeout(30)
    return driver

def get_headers():
    """Return headers that mimic a browser request"""
    return {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }

def should_skip_url(url):
    """Check if URL should be skipped"""
    if not url:
        return True
        
    # Skip URLs with fragments (#)
    if '#' in url:
        return True
        
    # Skip external links and special protocols
    if url.startswith(('mailto:', 'tel:', 'javascript:', 'whatsapp:')):
        return True
        
    # Skip blog pages and other unwanted sections
    skip_patterns = ['/blog/', '/category/', '/tag/', '/author/', '/feed/', '/rss/', 
                    'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com']
    if any(pattern in url.lower() for pattern in skip_patterns):
        return True
        
    # Skip common file types
    if any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip', '.css', '.js']):
        return True
        
    return False

def clean_text(text):
    """Clean and normalize text content"""
    if not text:
        return ""
    # Remove extra whitespace and special characters
    text = ' '.join(text.split())
    text = text.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
    return text

def get_all_links(driver):
    """Get all links from header, footer, and main content"""
    links = set()
    try:
        # Wait longer for dynamic content
        time.sleep(5)
        
        # Check for iframes
        iframes = driver.find_elements(By.TAG_NAME, "iframe")
        for iframe in iframes:
            try:
                driver.switch_to.frame(iframe)
                # Get links from iframe
                iframe_links = driver.find_elements(By.TAG_NAME, "a")
                for link in iframe_links:
                    try:
                        href = link.get_attribute('href')
                        if href:
                            print(f"Found iframe link: {href}")
                            links.add(href)
                    except StaleElementReferenceException:
                        continue
                driver.switch_to.default_content()
            except Exception as e:
                print(f"Error processing iframe: {e}")
                driver.switch_to.default_content()
                continue
        
        # Get links from main page with expanded selectors
        selectors = [
            'a[href]',  # All links with href attribute
            'header a, nav a, .header a, .navigation a, .menu a, .nav a',  # Navigation
            'footer a, .footer a',  # Footer
            'main a, #main a, .main-content a, .content a',  # Main content
            '.menu-item a',  # Menu items
            '.navbar a',  # Navigation bar
            '.sidebar a',  # Sidebar
            '[role="navigation"] a',  # ARIA navigation
        ]
        
        for selector in selectors:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
            for element in elements:
                try:
                    href = element.get_attribute('href')
                    if href:
                        print(f"Found link ({selector}): {href}")
                        links.add(href)
                except StaleElementReferenceException:
                    continue
                
    except Exception as e:
        print(f"Error getting links: {e}")
    
    return list(links)

def expand_dynamic_content(driver):
    """Expand dropdowns, FAQs, and other dynamic content"""
    try:
        # Wait for any dynamic content to load
        time.sleep(3)
        
        # Common selectors for expandable content
        expand_selectors = [
            '.faq-question', '.accordion-header', '.collapse-header',
            '[aria-expanded="false"]', '.toggle', '.dropdown-toggle',
            '.expand-button', '.show-more', '.read-more',
            '.elementor-tab-title', '.elementor-accordion-title',
            '.elementor-toggle-title', '.jet-toggle-title'
        ]
        
        # Try multiple times to expand elements (some might need previous ones to expand first)
        for attempt in range(3):
            for selector in expand_selectors:
                try:
                    # Re-find elements each time to avoid stale references
                    elements = WebDriverWait(driver, 5).until(
                        EC.presence_of_all_elements_located((By.CSS_SELECTOR, selector))
                    )
                    
                    for element in elements:
                        try:
                            # Scroll element into view
                            driver.execute_script("arguments[0].scrollIntoView(true);", element)
                            time.sleep(0.5)  # Let the page settle
                            
                            # Check if element is visible and clickable
                            if element.is_displayed():
                                # Try JavaScript click first
                                try:
                                    driver.execute_script("arguments[0].click();", element)
                                except:
                                    try:
                                        # Try regular click if JavaScript click fails
                                        element.click()
                                    except:
                                        continue
                                
                                time.sleep(0.5)  # Wait for animation
                        except:
                            continue
                            
                except Exception as e:
                    print(f"Error with selector {selector}: {e}")
                    continue
            
            # Wait between attempts
            time.sleep(1)
        
        # Special handling for FAQ sections
        faq_selectors = [
            '.faq', '#faq', '.faqs', '.accordion', 
            '[id*="faq"]', '[class*="faq"]',
            '.elementor-accordion', '.elementor-toggle',
            '.jet-accordion', '.jet-toggle'
        ]
        
        for selector in faq_selectors:
            try:
                sections = WebDriverWait(driver, 5).until(
                    EC.presence_of_all_elements_located((By.CSS_SELECTOR, selector))
                )
                
                for section in sections:
                    try:
                        # Scroll section into view
                        driver.execute_script("arguments[0].scrollIntoView(true);", section)
                        time.sleep(0.5)
                        
                        # Find all buttons/headers in this section
                        buttons = section.find_elements(By.CSS_SELECTOR, 
                            'button, [role="button"], .accordion-header, .elementor-tab-title, ' + 
                            '.elementor-toggle-title, .jet-toggle-title'
                        )
                        
                        for button in buttons:
                            try:
                                if button.is_displayed():
                                    driver.execute_script("arguments[0].click();", button)
                                    time.sleep(0.5)
                            except:
                                continue
                                
                    except Exception as e:
                        print(f"Error in FAQ section: {e}")
                        continue
                        
            except Exception as e:
                print(f"Error with FAQ selector {selector}: {e}")
                continue
    
    except Exception as e:
        print(f"Error in expand_dynamic_content: {e}")

def extract_emails(text, url):
    """Extract email addresses from text"""
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    emails = re.findall(email_pattern, text)
    
    # Also look for obfuscated emails
    obfuscated_pattern = r'[a-zA-Z0-9._%+-]+\s*[\[\(]?at\s*[\]\)]?\s*[a-zA-Z0-9.-]+\s*[\[\(]?dot\s*[\]\)]?\s*[a-zA-Z]{2,}'
    obfuscated_emails = re.findall(obfuscated_pattern, text.lower())
    
    # Convert obfuscated emails to normal format
    for obf_email in obfuscated_emails:
        normal_email = obf_email.replace(' at ', '@').replace(' dot ', '.').replace('[at]', '@').replace('(at)', '@')
        emails.append(normal_email)
    
    # Try to determine context for each email
    for email in set(emails):  # Use set to remove duplicates
        context = ""
        # Look for common patterns that might indicate the email's purpose
        lower_text = text.lower()
        email_idx = lower_text.find(email.lower())
        if email_idx != -1:
            # Get surrounding text (200 characters before and after)
            start = max(0, email_idx - 200)
            end = min(len(text), email_idx + len(email) + 200)
            surrounding_text = text[start:end].lower()
            
            # Check for common patterns
            if any(pattern in surrounding_text for pattern in ['contact', 'reach', 'email', 'write']):
                context = "Contact Email"
            elif any(pattern in surrounding_text for pattern in ['book', 'reserv', 'stay', 'accommodation']):
                context = "Booking Email"
            elif any(pattern in surrounding_text for pattern in ['support', 'help', 'assist']):
                context = "Support Email"
            elif any(pattern in surrounding_text for pattern in ['info', 'enquir', 'inquir']):
                context = "Information Email"
            
        with email_lock:
            # Check if this email is already recorded
            existing_entries = [e for e in email_data if e['email'] == email]
            if not existing_entries:
                email_data.append({
                    'email': email,
                    'url': url,
                    'context': context
                })
            elif context and not existing_entries[0]['context']:
                # Update context if we found one and the existing entry doesn't have one
                existing_entries[0]['context'] = context

def scrape_single_page(url, driver):
    """Scrape a single page and return its content"""
    try:
        print(f"Scraping: {url}")
        driver.get(url)
        
        # Wait for content to load
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Let JavaScript finish initial rendering
        time.sleep(3)
        
        # Expand dynamic content
        expand_dynamic_content(driver)
        
        # Get page content
        page_title = driver.title
        
        # Extract all text content
        body_text = driver.find_element(By.TAG_NAME, "body").text
        
        # Also get the page source to find any hidden emails
        page_source = driver.page_source
        
        # Extract emails from both visible text and source
        extract_emails(body_text, url)
        extract_emails(page_source, url)
        
        return {
            "url": url,
            "title": clean_text(page_title),
            "content": clean_text(body_text)
        }
        
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None

def normalize_domain(domain):
    """Normalize domain by removing www. prefix"""
    return domain.replace('www.', '')

def scrape_website(start_url, max_depth=1):
    """Scrape website using parallel processing"""
    # Get initial links from homepage
    driver = setup_driver()
    try:
        # Scrape homepage
        print("Scraping homepage...")
        driver.get(start_url)
        time.sleep(5)
        
        # Get all links
        links = get_all_links(driver)
        base_domain = normalize_domain(urlparse(start_url).netloc)
        
        # Filter links
        to_scrape = set()
        for href in links:
            if not href:
                continue
                
            absolute_link = urljoin(start_url, href)
            parsed_link = urlparse(absolute_link)
            link_domain = normalize_domain(parsed_link.netloc)
            
            if link_domain == base_domain and not should_skip_url(absolute_link):
                to_scrape.add(absolute_link)
        
        # Add homepage
        to_scrape.add(start_url)
        
        print(f"\nFound {len(to_scrape)} pages to scrape")
        
        # Create a pool of drivers for parallel processing
        num_threads = min(len(to_scrape), 4)  # Limit to 4 parallel threads
        drivers = [setup_driver() for _ in range(num_threads)]
        
        # Scrape pages in parallel
        scraped_data = []
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            future_to_url = {
                executor.submit(scrape_single_page, url, drivers[i % num_threads]): url
                for i, url in enumerate(to_scrape)
            }
            
            for future in future_to_url:
                url = future_to_url[future]
                try:
                    data = future.result()
                    if data:
                        scraped_data.append(data)
                except Exception as e:
                    print(f"Error processing {url}: {e}")
        
        # Clean up drivers
        for d in drivers:
            try:
                d.quit()
            except:
                pass
                
        return scraped_data
        
    finally:
        driver.quit()

def build_xml(scraped_data, output_file):
    """Build XML from scraped data and save to file"""
    root = ET.Element("website")
    root.set("domain", "lascanasbeachretreat.com")
    root.set("date_scraped", time.strftime("%Y-%m-%d %H:%M:%S"))
    
    # Add summary section
    summary = ET.SubElement(root, "summary")
    total_pages = ET.SubElement(summary, "total_pages")
    total_pages.text = str(len(scraped_data))
    total_emails = ET.SubElement(summary, "total_emails")
    total_emails.text = str(len(email_data))
    
    # Add pages section
    pages = ET.SubElement(root, "pages")
    for page in scraped_data:
        page_elem = ET.SubElement(pages, "page")
        
        # Add URL with its components
        url_info = ET.SubElement(page_elem, "url_info")
        url_elem = ET.SubElement(url_info, "full_url")
        url_elem.text = page["url"]
        parsed_url = urlparse(page["url"])
        path_elem = ET.SubElement(url_info, "path")
        path_elem.text = parsed_url.path
        
        # Add page title
        title_elem = ET.SubElement(page_elem, "title")
        title_elem.text = page["title"]
        
        # Add content with sections
        content_elem = ET.SubElement(page_elem, "content")
        content_elem.text = page["content"]
        
        # Add emails found on this page
        emails_elem = ET.SubElement(page_elem, "emails")
        page_emails = [e for e in email_data if e["url"] == page["url"]]
        for email in page_emails:
            email_elem = ET.SubElement(emails_elem, "email")
            address_elem = ET.SubElement(email_elem, "address")
            address_elem.text = email["email"]
            context_elem = ET.SubElement(email_elem, "context")
            context_elem.text = email["context"] if email["context"] else "Unknown"
    
    # Create a formatted string of the XML
    rough_string = ET.tostring(root, encoding='utf-8')
    reparsed = minidom.parseString(rough_string)
    formatted_xml = reparsed.toprettyxml(indent="  ")
    
    # Write to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(formatted_xml)
    
    # Print summary
    print("\nScraping Summary:")
    print(f"Total pages scraped: {len(scraped_data)}")
    print(f"Total emails found: {len(email_data)}")
    print("\nScraped pages:")
    for page in scraped_data:
        print(f"- {page['url']}")
        page_emails = [e for e in email_data if e["url"] == page["url"]]
        if page_emails:
            print(f"  Emails found: {len(page_emails)}")

def save_emails_to_csv(output_file="extracted_emails.csv"):
    """Save extracted emails to CSV file"""
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['email', 'url', 'context'])
        writer.writeheader()
        writer.writerows(email_data)
    print(f"\nEmails saved to {output_file}")

if __name__ == "__main__":
    start_url = "https://www.lascanasbeachretreat.com"
    output_xml = "lascanasbeachretreat_data.xml"
    output_csv = "lascanasbeachretreat_emails.csv"
    
    print("Starting web scraping...")
    scraped_data = scrape_website(start_url)
    
    print("\nBuilding XML file...")
    build_xml(scraped_data, output_xml)
    print(f"Data saved to {output_xml}")
    
    print("\nSaving emails...")
    save_emails_to_csv(output_csv)
    print(f"Emails saved to {output_csv}")
    
    print("\nScraping Summary:")
    print(f"Total pages scraped: {len(scraped_data)}")
    print(f"Total emails found: {len(email_data)}")
    print("\nScraped pages:")
    for page in scraped_data:
        print(f"- {page['url']}") 