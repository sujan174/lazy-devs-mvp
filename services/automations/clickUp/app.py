import os
import json
import requests
import logging
from typing import Dict, List, Any
from datetime import datetime

import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# --- LOGGING CONFIGURATION ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# --- 1. CONFIGURATION and SETUP ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("Please set GEMINI_API_KEY as an environment variable.")

logger.info(f"✅ API Key loaded: {GEMINI_API_KEY[:10]}..." if len(GEMINI_API_KEY) > 10 else "⚠️  API Key is too short!")

genai.configure(api_key=GEMINI_API_KEY)
token_auth_scheme = HTTPBearer()

# --- 2. CLICKUP API CLIENT CLASS ---
class ClickUpClient:
    def __init__(self, api_token: str):
        if not api_token:
            raise ValueError("ClickUp API token is required for the client.")
        self.api_token = api_token
        self.base_url = "https://api.clickup.com/api/v2/"
        self.headers = {"Authorization": self.api_token, "Content-Type": "application/json"}
        logger.info("✅ ClickUpClient initialized")

    def _make_request(self, method: str, endpoint: str, params: Dict = None, json_data: Dict = None) -> Any:
        """Make a request to ClickUp API with improved error handling"""
        url = self.base_url + endpoint
        logger.info(f"🌐 Making {method} request to ClickUp: {endpoint}")
        
        try:
            response = requests.request(
                method, 
                url, 
                headers=self.headers, 
                params=params,
                json=json_data
            )
            response.raise_for_status()
            logger.info(f"✅ ClickUp API request successful: {endpoint}")
            return response.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f"❌ ClickUp API HTTP Error: {e.response.status_code} - {e.response.text}")
            raise HTTPException(
                status_code=e.response.status_code, 
                detail=f"ClickUp API Error: {e.response.text}"
            )
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Network error connecting to ClickUp: {str(e)}")
            raise HTTPException(
                status_code=503, 
                detail=f"Network error connecting to ClickUp: {str(e)}"
            )

    def get_space_details(self, space_id: str) -> Dict[str, Any]:
        logger.info(f"📋 Fetching space details for space_id: {space_id}")
        return self._make_request("GET", f"space/{space_id}")

    def get_all_lists_in_space(self, space_id: str) -> List[Dict[str, Any]]:
        logger.info(f"📝 Fetching all lists in space: {space_id}")
        all_lists = []
        try:
            # Get folderless lists
            folderless_lists_data = self._make_request("GET", f"space/{space_id}/list")
            folderless_count = len(folderless_lists_data.get("lists", []))
            all_lists.extend(folderless_lists_data.get("lists", []))
            logger.info(f"  └─ Found {folderless_count} folderless lists")
            
            # Get folders and their lists
            folders_data = self._make_request("GET", f"space/{space_id}/folder")
            folders = folders_data.get("folders", [])
            logger.info(f"  └─ Found {len(folders)} folders")
            
            for folder in folders:
                lists_in_folder_data = self._make_request("GET", f"folder/{folder['id']}/list")
                folder_lists = lists_in_folder_data.get("lists", [])
                all_lists.extend(folder_lists)
                logger.info(f"     └─ Folder '{folder.get('name')}': {len(folder_lists)} lists")
        except HTTPException as e:
            if e.status_code != 404:
                raise
            logger.warning(f"⚠️  No folders found in space (404 error ignored)")
        
        logger.info(f"✅ Total lists found: {len(all_lists)}")
        return all_lists

    def get_all_tasks_in_space(self, space_id: str) -> List[Dict[str, Any]]:
        logger.info(f"📊 Fetching all tasks in space: {space_id}")
        all_lists = self.get_all_lists_in_space(space_id)
        all_tasks = []
        
        for idx, list_item in enumerate(all_lists, 1):
            list_name = list_item.get('name', 'Unknown')
            list_id = list_item['id']
            logger.info(f"  [{idx}/{len(all_lists)}] Fetching tasks from list: '{list_name}'")
            
            page = 0
            list_task_count = 0
            while True:
                params = {"page": page, "subtasks": "true"}
                data = self._make_request("GET", f"list/{list_id}/task", params=params)
                tasks = data.get("tasks", [])
                if not tasks:
                    break
                all_tasks.extend(tasks)
                list_task_count += len(tasks)
                page += 1
            
            logger.info(f"     └─ Found {list_task_count} tasks")
        
        logger.info(f"✅ Total tasks found: {len(all_tasks)}")
        return all_tasks

    def get_team_users(self) -> List[Dict[str, Any]]:
        logger.info("👥 Fetching team users")
        teams_data = self._make_request("GET", "team")
        teams = teams_data.get("teams", [])
        members = teams[0].get("members", []) if teams else []
        logger.info(f"✅ Found {len(members)} team members")
        return members

    def get_custom_fields(self, list_id: str) -> List[Dict[str, Any]]:
        try:
            fields_data = self._make_request("GET", f"list/{list_id}/field")
            fields = fields_data.get("fields", [])
            return fields
        except HTTPException:
            return []

# --- 3. DATA FILTERING and PROMPT GENERATION ---
def filter_clickup_tasks(raw_tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Filter and structure task data for AI processing"""
    logger.info(f"🔍 Filtering {len(raw_tasks)} tasks for AI processing")
    filtered_tasks = []
    
    for task in raw_tasks:
        assignees = [
            a.get("username") or a.get("email") 
            for a in task.get("assignees", []) if a
        ]
        assignee_field = assignees[0] if len(assignees) == 1 else assignees if assignees else None
        
        filtered_task = {
            "id": task.get("id"),
            "name": task.get("name"),
            "status": task.get("status", {}).get("status"),
            "assignee": assignee_field
        }
        
        if task.get("parent"):
            filtered_task["parent_id"] = task.get("parent")
        else:
            filtered_task["list"] = {
                "id": task.get("list", {}).get("id"), 
                "name": task.get("list", {}).get("name")
            }
        
        dependencies = task.get("dependencies", [])
        if dependencies:
            waiting_on_ids = [
                dep.get("depends_on") for dep in dependencies 
                if dep.get("depends_on") and dep.get("task_id") == task.get("id")
            ]
            if waiting_on_ids:
                filtered_task["dependencies"] = waiting_on_ids
        
        filtered_tasks.append(filtered_task)
    
    logger.info(f"✅ Filtered {len(filtered_tasks)} tasks")
    return filtered_tasks

class PromptGenerator:
    def __init__(self, client: ClickUpClient, template_path: str = "system_prompt_template.txt"):
        self.client = client
        logger.info(f"📄 Loading prompt template from: {template_path}")
        
        if not os.path.exists(template_path):
            logger.error(f"❌ Prompt template file not found: {template_path}")
            raise FileNotFoundError(f"Prompt template file not found: {template_path}")
        
        with open(template_path, 'r', encoding='utf-8') as f:
            self.template_content = f.read()
        
        logger.info(f"✅ Prompt template loaded ({len(self.template_content)} characters)")
    
    def _format_statuses(self, details: Dict) -> str:
        """Format status dictionary for prompt"""
        return "\n".join([
            f'* "{s["status"]}" (type: {s["type"]})' 
            for s in details.get("statuses", [])
        ])
    
    def _format_lists(self, lists: List[Dict]) -> str:
        """Format lists dictionary for prompt"""
        return "\n".join([
            f'- {{"list_id": "{l.get("id")}", "list_name": "{l.get("name")}"}}' 
            for l in lists
        ])
    
    def _format_assignees(self, users: List[Dict]) -> str:
        """Format assignees dictionary for prompt"""
        formatted_users = []
        for u in users:
            user_data = u.get("user", {})
            if user_data.get("id") and user_data.get("username"):
                formatted_users.append(
                    f'- {{"user_id": {user_data["id"]}, "username": "{user_data["username"]}"}}'
                )
        return "\n".join(formatted_users) if formatted_users else "No users found."
    
    def _format_custom_fields(self, fields_map: Dict) -> str:
        """Format custom fields dictionary for prompt"""
        lines = []
        for list_id, data in fields_map.items():
            if data['fields']:
                lines.append(f'For list "{data["list_name"]}" (id: {list_id}):')
                for field in data['fields']:
                    lines.append(
                        f'  - {{"id": "{field["id"]}", "name": "{field["name"]}", "type": "{field["type"]}"}}'
                    )
        return "\n".join(lines) if lines else "No custom fields found."
    
    def create_system_prompt(self, space_id: str) -> str:
        """Create formatted system prompt with live project data"""
        logger.info(f"🔧 Creating system prompt for space: {space_id}")
        
        space_details = self.client.get_space_details(space_id)
        project_lists = self.client.get_all_lists_in_space(space_id)
        team_users = self.client.get_team_users()
        
        logger.info("🔧 Fetching custom fields for all lists")
        fields_by_list = {}
        for l in project_lists:
            fields_by_list[l['id']] = {
                'list_name': l['name'], 
                'fields': self.client.get_custom_fields(l['id'])
            }
        
        # Create the data dictionary with all required placeholders
        format_dict = {
            "project_statuses": self._format_statuses(space_details),
            "project_lists": self._format_lists(project_lists),
            "assignee_details": self._format_assignees(team_users),
            "custom_fields": self._format_custom_fields(fields_by_list),
            "current_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        try:
            system_prompt = self.template_content.format(**format_dict)
            logger.info(f"✅ System prompt created ({len(system_prompt)} characters)")
            return system_prompt
        except KeyError as e:
            missing_key = str(e).strip("'")
            available_keys = list(format_dict.keys())
            logger.error(f"❌ Template formatting error: Missing placeholder '{missing_key}'")
            error_detail = (
                f"Template formatting error: Missing placeholder '{missing_key}' in system_prompt_template.txt. "
                f"Available placeholders: {available_keys}. "
                f"Please ensure your template uses the correct placeholder names."
            )
            raise HTTPException(status_code=500, detail=error_detail)

def call_gemini_api(system_prompt: str, board_state: List[Dict], transcript: str) -> str:
    """Call Gemini API with error handling"""
    logger.info("🤖 Preparing Gemini API call")
    logger.info(f"  └─ Board state: {len(board_state)} tasks")
    logger.info(f"  └─ Transcript length: {len(transcript)} characters")
    
    generation_config = {
        "temperature": 0.3,
        "top_p": 0.95,
        "top_k": 40,
        "max_output_tokens": 8192,
    }
    
    try:
        model = genai.GenerativeModel(
            model_name='models/gemini-2.5-pro',
            system_instruction=system_prompt,
            generation_config=generation_config
        )
        
        user_prompt = f"""
Here is the current state of the project board in JSON format:
<BOARD_STATE>
{json.dumps(board_state, indent=2)}
</BOARD_STATE>

Here is the transcript of a recent meeting or a user request to analyze:
<TRANSCRIPT>
{transcript}
</TRANSCRIPT>

Based on all the provided context, please provide your response as a valid JSON array following the output schema defined in your instructions.
"""
        
        logger.info("🚀 Calling Gemini 2.5 Pro API...")
        response = model.generate_content(user_prompt)
        
        # Check if response is blocked or has issues
        if not response.text:
            logger.error("❌ Gemini returned empty response")
            raise ValueError("Gemini returned empty response")
        
        logger.info(f"✅ Gemini API response received ({len(response.text)} characters)")
        logger.info(f"  └─ Response preview: {response.text[:200]}...")
        
        return response.text
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ Gemini API Error: {error_msg}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error calling Gemini API: {error_msg}"
        )

# --- 4. FASTAPI APPLICATION ---
app = FastAPI(
    title="ClickUp AI Agent Service",
    description="Processes transcripts to suggest ClickUp actions using a user's OAuth token.",
    version="1.0.0"
)

class ProcessRequest(BaseModel):
    space_id: str
    transcript: str

@app.post("/process-transcript")
async def process_transcript_and_get_actions(
    request: ProcessRequest,
    auth: HTTPAuthorizationCredentials = Security(token_auth_scheme)
):
    """Process meeting transcript and generate ClickUp actions"""
    logger.info("=" * 80)
    logger.info(f"📥 NEW REQUEST: Processing transcript for space_id: {request.space_id}")
    logger.info(f"  └─ Transcript length: {len(request.transcript)} characters")
    logger.info("=" * 80)
    
    try:
        user_clickup_token = auth.credentials
        logger.info(f"🔑 Token received: {user_clickup_token[:20]}...")
        
        clickup_client = ClickUpClient(api_token=user_clickup_token)
        prompt_generator = PromptGenerator(client=clickup_client)
        
        # Fetch and process data
        logger.info("📊 Step 1: Fetching raw tasks from ClickUp")
        raw_tasks = clickup_client.get_all_tasks_in_space(request.space_id)
        
        logger.info("🔍 Step 2: Filtering tasks")
        filtered_board_state = filter_clickup_tasks(raw_tasks)
        
        logger.info("🔧 Step 3: Creating system prompt")
        system_prompt = prompt_generator.create_system_prompt(request.space_id)
        
        # Call Gemini
        logger.info("🤖 Step 4: Calling Gemini API")
        gemini_response = call_gemini_api(
            system_prompt=system_prompt,
            board_state=filtered_board_state,
            transcript=request.transcript
        )
        
        logger.info("✅ REQUEST COMPLETED SUCCESSFULLY")
        logger.info("=" * 80)
        
        return {"ai_response": gemini_response}
        
    except HTTPException as e:
        logger.error(f"❌ HTTP Exception: {e.status_code} - {e.detail}")
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )

@app.get("/")
def read_root():
    logger.info("📡 Root endpoint accessed")
    return {
        "status": "ClickUp AI Agent Service is running.",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    """Health check endpoint"""
    logger.info("🏥 Health check endpoint accessed")
    return {
        "status": "healthy",
        "gemini_configured": bool(GEMINI_API_KEY),
        "timestamp": datetime.now().isoformat()
    }

# Log on startup
logger.info("🚀 ClickUp AI Agent Service starting up...")
logger.info(f"  └─ Gemini API configured: {bool(GEMINI_API_KEY)}")
logger.info(f"  └─ Python version: {os.sys.version}")
logger.info("=" * 80)