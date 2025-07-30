import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Upload, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface GoogleDriveConnectorProps {
  onFolderSelected: (folderId: string, folderName: string) => void;
  isConnected: boolean;
}

export const GoogleDriveConnector = ({ onFolderSelected, isConnected }: GoogleDriveConnectorProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [accessToken, setAccessToken] = useState<string>("");
  const [folderUrl, setFolderUrl] = useState<string>("");

  const handleConnect = async () => {
    if (!accessToken.trim()) {
      toast("Please enter your Google Drive access token");
      return;
    }

    setIsConnecting(true);
    try {
      // Test the connection by fetching user info
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid access token');
      }

      const data = await response.json();
      localStorage.setItem('gdrive_token', accessToken);
      
      toast("Connected to Google Drive successfully!", {
        description: `Welcome ${data.user.displayName}`
      });
    } catch (error) {
      toast("Failed to connect to Google Drive", {
        description: "Please check your access token"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleFolderSelect = async () => {
    if (!folderUrl.trim()) {
      toast("Please enter a Google Drive folder URL");
      return;
    }

    try {
      // Extract folder ID from URL
      const folderIdMatch = folderUrl.match(/folders\/([a-zA-Z0-9-_]+)/);
      if (!folderIdMatch) {
        toast("Invalid folder URL format");
        return;
      }

      const folderId = folderIdMatch[1];
      const token = localStorage.getItem('gdrive_token');

      if (!token) {
        toast("Please connect to Google Drive first");
        return;
      }

      // Get folder info
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=name`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Cannot access folder');
      }

      const folderData = await response.json();
      onFolderSelected(folderId, folderData.name);
      
      toast("Folder selected successfully!", {
        description: `Selected: ${folderData.name}`
      });
    } catch (error) {
      toast("Failed to select folder", {
        description: "Please check the folder URL and permissions"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="w-5 h-5" />
          Google Drive Integration
        </CardTitle>
        <CardDescription>
          Connect to Google Drive to upload exported videos directly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="access-token">Google Drive Access Token</Label>
              <Input
                id="access-token"
                type="password"
                placeholder="Enter your access token..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your token from{" "}
                <a 
                  href="https://developers.google.com/oauthplayground/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  OAuth 2.0 Playground
                </a>
              </p>
            </div>
            
            <Button 
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4 mr-2" />
                  Connect to Google Drive
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-green-600">
              <Check className="w-4 h-4" />
              <span className="text-sm">Connected to Google Drive</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="folder-url">Drive Folder URL</Label>
              <Input
                id="folder-url"
                placeholder="https://drive.google.com/drive/folders/..."
                value={folderUrl}
                onChange={(e) => setFolderUrl(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={handleFolderSelect}
              variant="outline"
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Select Upload Folder
            </Button>
          </>
        )}
        
        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-600 dark:text-blue-400">
              <p className="font-medium mb-1">How to get access token:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Visit OAuth 2.0 Playground</li>
                <li>Select "Drive API v3" and authorize scopes</li>
                <li>Exchange authorization code for tokens</li>
                <li>Copy the access token</li>
              </ol>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};